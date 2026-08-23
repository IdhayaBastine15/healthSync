from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from redis.asyncio import Redis
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user, get_redis
from app.db.session import get_db
from app.models.analytics import LabTurnaround, RecordAccessLog
from app.schemas.analytics import (
    CriticalAlertsReportOut,
    DashboardOut,
    LabTurnaroundOut,
    LabTurnaroundReportOut,
    PatientVolumeDay,
    StreamLag,
    SystemHealthOut,
)
from app.services.consumer import GROUP, STREAMS

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _parse_date_range(date_range: str) -> tuple[date, date]:
    try:
        start_str, end_str = date_range.split("_")
        return date.fromisoformat(start_str), date.fromisoformat(end_str)
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_DATE_RANGE", "message": "Expected format: YYYY-MM-DD_YYYY-MM-DD"}})


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("ANALYTICS_READ")

    total_filed = (await db.execute(select(func.count()).select_from(LabTurnaround))).scalar_one()
    pending = (
        await db.execute(select(func.count()).select_from(LabTurnaround).where(LabTurnaround.acknowledged_at.is_(None)))
    ).scalar_one()
    critical_total = (
        await db.execute(select(func.count()).select_from(LabTurnaround).where(LabTurnaround.is_critical.is_(True)))
    ).scalar_one()
    avg_ack = (await db.execute(select(func.avg(LabTurnaround.time_to_acknowledge_seconds)))).scalar_one()
    avg_critical_ack = (
        await db.execute(
            select(func.avg(LabTurnaround.time_to_acknowledge_seconds)).where(LabTurnaround.is_critical.is_(True))
        )
    ).scalar_one()
    updates_24h = (
        await db.execute(
            select(func.count())
            .select_from(RecordAccessLog)
            .where(RecordAccessLog.accessed_at >= func.now() - text("interval '24 hours'"))
        )
    ).scalar_one()

    return DashboardOut(
        results_filed_total=total_filed,
        results_pending_acknowledgement=pending,
        critical_alerts_total=critical_total,
        avg_time_to_acknowledge_seconds=float(avg_ack) if avg_ack is not None else None,
        avg_critical_time_to_acknowledge_seconds=float(avg_critical_ack) if avg_critical_ack is not None else None,
        record_updates_last_24h=updates_24h,
    )


@router.get("/lab-turnaround/{date_range}", response_model=LabTurnaroundReportOut)
async def lab_turnaround(date_range: str, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("ANALYTICS_READ")
    start, end = _parse_date_range(date_range)

    stmt = select(LabTurnaround).where(LabTurnaround.filed_at >= start, LabTurnaround.filed_at < end).order_by(LabTurnaround.filed_at)
    rows = (await db.execute(stmt)).scalars().all()
    ack_seconds = [r.time_to_acknowledge_seconds for r in rows if r.time_to_acknowledge_seconds is not None]

    return LabTurnaroundReportOut(
        date_range={"start": start.isoformat(), "end": end.isoformat()},
        total_results=len(rows),
        avg_time_to_acknowledge_seconds=sum(ack_seconds) / len(ack_seconds) if ack_seconds else None,
        results=[LabTurnaroundOut.model_validate(r) for r in rows],
    )


@router.get("/critical-alerts/{date_range}", response_model=CriticalAlertsReportOut)
async def critical_alerts(date_range: str, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("ANALYTICS_READ")
    start, end = _parse_date_range(date_range)

    stmt = (
        select(LabTurnaround)
        .where(LabTurnaround.is_critical.is_(True), LabTurnaround.filed_at >= start, LabTurnaround.filed_at < end)
        .order_by(LabTurnaround.filed_at)
    )
    rows = (await db.execute(stmt)).scalars().all()
    ack_seconds = [r.time_to_acknowledge_seconds for r in rows if r.time_to_acknowledge_seconds is not None]

    return CriticalAlertsReportOut(
        date_range={"start": start.isoformat(), "end": end.isoformat()},
        total_critical_alerts=len(rows),
        acknowledged_count=len(ack_seconds),
        avg_time_to_acknowledge_seconds=sum(ack_seconds) / len(ack_seconds) if ack_seconds else None,
        alerts=[LabTurnaroundOut.model_validate(r) for r in rows],
    )


@router.get("/patient-volume", response_model=list[PatientVolumeDay])
async def patient_volume(days: int = Query(30, le=365, ge=1), db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Doc §6 asks for "admissions/discharges over time" - there's no such
    event in this system, only patient.record.updated (see
    app/services/consumer.py), so this reports record-update volume per day
    as the closest available proxy for patient record activity."""
    user.require("ANALYTICS_READ")

    day_col = func.date_trunc("day", RecordAccessLog.accessed_at).label("day")
    stmt = (
        select(day_col, func.count().label("count"))
        .group_by(day_col)
        .order_by(day_col.desc())
        .limit(days)
    )
    rows = (await db.execute(stmt)).all()
    return [PatientVolumeDay(day=r.day.date(), record_updates=r.count) for r in rows]


@router.get("/system-health", response_model=SystemHealthOut)
async def system_health(redis: Redis = Depends(get_redis), user: CurrentUser = Depends(get_current_user)):
    """Doc §6 asks for "all services health + Kafka lag" - cross-service HTTP
    health polling isn't wired up here (no per-service URLs are configured
    for this service, unlike api-gateway), so this reports the one half that
    fits Redis Streams directly: how far analytics-consumers is behind on
    each stream it consumes, the direct equivalent of Kafka consumer lag."""
    user.require("ANALYTICS_READ")
    try:
        streams = []
        for stream in STREAMS:
            key = f"stream:{stream}"
            length = await redis.xlen(key)
            try:
                pending_summary = await redis.xpending(key, GROUP)
                pending = pending_summary["pending"] if pending_summary else 0
            except Exception:
                pending = 0
            streams.append(StreamLag(stream=stream, length=length, pending=pending))
        return SystemHealthOut(consumer_group=GROUP, streams=streams)
    finally:
        await redis.aclose()
