import asyncio
import json
import logging
import uuid
from datetime import datetime

from redis.asyncio import Redis
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.analytics import LabTurnaround, RecordAccessLog

logger = logging.getLogger("analytics-consumer")

# Mirrors doc §6 "Kafka consumers" for the Analytics Service - see
# shared/EVENTS.md for why Redis Streams stand in for Kafka here.
STREAMS = [
    "lab.result.filed",
    "lab.result.critical",
    "lab.result.acknowledged",
    "patient.record.updated",
]
GROUP = "analytics-consumers"
CONSUMER_NAME = f"analytics-service-{uuid.uuid4().hex[:8]}"


def parse_timestamp(envelope: dict) -> datetime:
    return datetime.fromisoformat(envelope["timestamp"])


def compute_ack_seconds(filed_at: datetime, acknowledged_at: datetime) -> int:
    return max(0, int((acknowledged_at - filed_at).total_seconds()))


async def _handle_lab_result_filed(session, envelope: dict) -> None:
    session.add(
        LabTurnaround(
            result_id=envelope["result_id"],
            patient_id=envelope["patient_id"],
            filed_at=parse_timestamp(envelope),
            is_critical=bool(envelope.get("is_critical", False)),
        )
    )


async def _handle_lab_result_critical(session, envelope: dict) -> None:
    # lab.result.filed and lab.result.critical are produced back-to-back for
    # the same result (services/lab-service/app/routers/results.py), but
    # delivery order across two streams isn't guaranteed - fall back to
    # inserting the row here too if the filed event hasn't landed yet.
    row = (
        await session.execute(select(LabTurnaround).where(LabTurnaround.result_id == envelope["result_id"]))
    ).scalar_one_or_none()
    if row is None:
        session.add(
            LabTurnaround(
                result_id=envelope["result_id"],
                patient_id=envelope["patient_id"],
                filed_at=parse_timestamp(envelope),
                is_critical=True,
            )
        )
    else:
        row.is_critical = True


async def _handle_lab_result_acknowledged(session, envelope: dict) -> None:
    row = (
        await session.execute(select(LabTurnaround).where(LabTurnaround.result_id == envelope["result_id"]))
    ).scalar_one_or_none()
    if row is None:
        return
    acknowledged_at = parse_timestamp(envelope)
    row.acknowledged_at = acknowledged_at
    row.time_to_acknowledge_seconds = compute_ack_seconds(row.filed_at, acknowledged_at)


async def _handle_patient_record_updated(session, envelope: dict) -> None:
    session.add(RecordAccessLog(patient_id=envelope["patient_id"], accessed_at=parse_timestamp(envelope)))


HANDLERS = {
    "lab.result.filed": _handle_lab_result_filed,
    "lab.result.critical": _handle_lab_result_critical,
    "lab.result.acknowledged": _handle_lab_result_acknowledged,
    "patient.record.updated": _handle_patient_record_updated,
}


async def _ensure_groups(redis: Redis) -> None:
    for stream in STREAMS:
        key = f"stream:{stream}"
        try:
            await redis.xgroup_create(key, GROUP, id="0", mkstream=True)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                raise


async def _process_entry(event_type: str, fields: dict) -> bool:
    try:
        envelope = json.loads(fields["data"])
        async with SessionLocal() as session:
            await HANDLERS[event_type](session, envelope)
            await session.commit()
        return True
    except Exception:
        logger.exception("Failed to process analytics event for stream %s", event_type)
        return False


async def run_consumer() -> None:
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    await _ensure_groups(redis)
    stream_keys = {f"stream:{s}": ">" for s in STREAMS}

    while True:
        try:
            response = await redis.xreadgroup(GROUP, CONSUMER_NAME, stream_keys, count=20, block=5000)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Redis XREADGROUP failed, retrying")
            await asyncio.sleep(2)
            continue

        if not response:
            continue

        for stream_key, entries in response:
            event_type = stream_key.removeprefix("stream:")
            for entry_id, fields in entries:
                ok = await _process_entry(event_type, fields)
                if not ok:
                    await redis.xadd(f"{stream_key}.dlq", fields)
                await redis.xack(stream_key, GROUP, entry_id)
