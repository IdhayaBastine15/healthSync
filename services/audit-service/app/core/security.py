import json
from pathlib import Path

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis

from app.core.config import get_settings

security = HTTPBearer()

# Container layout: /app/app/core/security.py + /app/shared/rbac.json (see Dockerfile).
# Local (non-container) layout: services/audit-service/app/core/security.py + <repo>/shared/rbac.json.
_FILE = Path(__file__).resolve()
_CANDIDATES = [_FILE.parents[n] / "shared" / "rbac.json" for n in (2, 4) if len(_FILE.parents) > n]
RBAC = {"permissions": {}}
for _candidate in _CANDIDATES:
    if _candidate.exists():
        RBAC = json.loads(_candidate.read_text())
        break


def _public_key() -> str:
    return Path(get_settings().jwt_public_key_path).read_text()


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, _public_key(), algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": {"code": "TOKEN_EXPIRED", "message": "Access token has expired"}})
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": {"code": "TOKEN_INVALID", "message": "Access token is invalid"}})


class CurrentUser:
    def __init__(self, user_id: str, roles: list[str], jti: str):
        self.user_id = user_id
        self.roles = roles
        self.jti = jti

    def has_permission(self, permission: str) -> bool:
        allowed_roles = RBAC.get("permissions", {}).get(permission, [])
        return any(role in allowed_roles for role in self.roles)

    def require(self, permission: str) -> None:
        if not self.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": f"Requires permission: {permission}"}},
            )


async def get_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    payload = decode_access_token(credentials.credentials)
    redis = await get_redis()
    try:
        if await redis.exists(f"jwt:blacklist:{payload['jti']}"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error": {"code": "TOKEN_REVOKED", "message": "Token has been revoked"}})
    finally:
        await redis.aclose()
    return CurrentUser(user_id=payload["sub"], roles=payload.get("roles", []), jti=payload["jti"])
