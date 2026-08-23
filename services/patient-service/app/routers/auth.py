import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token, get_redis, hash_password, verify_password
from app.db.session import get_db
from app.models.patient import User
from app.schemas.patient import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.streams.producer import StreamProducer

router = APIRouter(tags=["auth"])
settings = get_settings()

LOCKOUT_THRESHOLD = 5
LOCKOUT_WINDOW_SECONDS = 600


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)):
    lockout_key = f"ratelimit:login:{body.email}"
    attempts = int(await redis.get(lockout_key) or 0)
    if attempts >= LOCKOUT_THRESHOLD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": {"code": "ACCOUNT_LOCKED", "message": "Too many failed attempts. Try again later."}})

    result = await db.execute(select(User).where(User.email == body.email, User.is_active.is_(True)))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        await redis.incr(lockout_key)
        await redis.expire(lockout_key, LOCKOUT_WINDOW_SECONDS)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"}})

    await redis.delete(lockout_key)

    access_token, jti = create_access_token(str(user.id), user.roles)
    refresh_token = str(uuid4())
    await redis.setex(f"session:{refresh_token}", settings.refresh_token_expire_hours * 3600, json.dumps({"user_id": str(user.id), "roles": user.roles}))

    producer = StreamProducer(redis)
    await producer.produce(
        "audit.event.logged",
        "audit.event.logged",
        {
            "user_id": str(user.id),
            "action": "LOGIN",
            "resource_type": "auth",
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "outcome": "SUCCESS",
        },
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=settings.access_token_expire_minutes * 60)


@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)):
    """Self-signup, no admin approval step - see README.md's "Self-signup"
    section for why that's a deliberate demo-only trade-off, not an
    oversight. RegisterRequest.roles still validates against
    shared/rbac.json's role list (app/schemas/patient.py), so a caller can't
    invent a role that doesn't exist, just claim any of the real ones."""
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        given_name=body.given_name,
        family_name=body.family_name,
        roles=body.roles,
        department=body.department,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error": {"code": "EMAIL_TAKEN", "message": "An account with this email already exists"}})
    await db.refresh(user)

    access_token, jti = create_access_token(str(user.id), user.roles)
    refresh_token = str(uuid4())
    await redis.setex(f"session:{refresh_token}", settings.refresh_token_expire_hours * 3600, json.dumps({"user_id": str(user.id), "roles": user.roles}))

    producer = StreamProducer(redis)
    await producer.produce(
        "audit.event.logged",
        "audit.event.logged",
        {
            "user_id": str(user.id),
            "action": "REGISTER",
            "resource_type": "auth",
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "outcome": "SUCCESS",
        },
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token, expires_in=settings.access_token_expire_minutes * 60)


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)):
    session_raw = await redis.get(f"session:{body.refresh_token}")
    if not session_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": {"code": "INVALID_REFRESH_TOKEN", "message": "Refresh token invalid or expired"}})
    session = json.loads(session_raw)
    access_token, _ = create_access_token(session["user_id"], session["roles"])
    return TokenResponse(access_token=access_token, refresh_token=body.refresh_token, expires_in=settings.access_token_expire_minutes * 60)


@router.post("/auth/logout", status_code=204)
async def logout(request: Request, redis: Redis = Depends(get_redis)):
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        payload = decode_access_token(auth_header.removeprefix("Bearer "))
        ttl = payload["exp"] - int(datetime.now(timezone.utc).timestamp())
        if ttl > 0:
            await redis.setex(f"jwt:blacklist:{payload['jti']}", ttl, "1")
