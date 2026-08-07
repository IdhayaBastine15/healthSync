import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.audit import AuditEvent
from app.schemas.audit import AuditEventOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/patient/{patient_id}", response_model=list[AuditEventOut])
async def get_patient_audit_trail(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("AUDIT_READ")
    stmt = select(AuditEvent).where(AuditEvent.patient_id == patient_id).order_by(AuditEvent.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.get("/user/{user_id}", response_model=list[AuditEventOut])
async def get_user_audit_trail(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("AUDIT_READ")
    stmt = select(AuditEvent).where(AuditEvent.user_id == user_id).order_by(AuditEvent.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.get("/events", response_model=list[AuditEventOut])
async def get_events(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    user.require("AUDIT_READ")
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset)
    return (await db.execute(stmt)).scalars().all()


@router.get("/report/{date_range}")
async def gdpr_report(date_range: str, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """date_range format: YYYY-MM-DD_YYYY-MM-DD (doc §5 GDPR right-to-access report)."""
    user.require("GDPR_REPORT")
    try:
        start_str, end_str = date_range.split("_")
        start, end = date.fromisoformat(start_str), date.fromisoformat(end_str)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_DATE_RANGE", "message": "Expected format: YYYY-MM-DD_YYYY-MM-DD"}})

    stmt = select(AuditEvent).where(AuditEvent.created_at >= start, AuditEvent.created_at < end).order_by(AuditEvent.created_at)
    events = (await db.execute(stmt)).scalars().all()
    return {
        "date_range": {"start": start.isoformat(), "end": end.isoformat()},
        "total_events": len(events),
        "events": [AuditEventOut.model_validate(e).model_dump(mode="json") for e in events],
    }
