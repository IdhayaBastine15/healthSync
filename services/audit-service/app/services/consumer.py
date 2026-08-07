import asyncio
import json
import logging
import uuid

from redis.asyncio import Redis

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.audit import AuditEvent

logger = logging.getLogger("audit-consumer")

# Mirrors the Kafka consumer topology in the architecture doc §5 (Service 5):
# audit-service both records explicit audit.event.logged entries verbatim and
# auto-logs the domain events themselves as a belt-and-braces trail — see
# shared/EVENTS.md for why Redis Streams stand in for Kafka here.
STREAMS = [
    "audit.event.logged",
    "patient.record.updated",
    "lab.result.filed",
    "lab.result.critical",
    "lab.result.acknowledged",
]
GROUP = "audit-consumers"
CONSUMER_NAME = f"audit-service-{uuid.uuid4().hex[:8]}"

_AUTO_LOG_DEFAULTS = {
    "patient.record.updated": {"action": "UPDATE", "resource_type": "patient"},
    "lab.result.filed": {"action": "CREATE", "resource_type": "lab_result"},
    "lab.result.critical": {"action": "CRITICAL_ALERT", "resource_type": "lab_result"},
    "lab.result.acknowledged": {"action": "ACKNOWLEDGE", "resource_type": "lab_result"},
}


def envelope_to_audit_row(event_type: str, envelope: dict) -> dict:
    row = {
        "event_type": event_type,
        "user_id": envelope.get("user_id") or envelope.get("updated_by") or envelope.get("acknowledged_by"),
        "user_role": envelope.get("user_role"),
        "patient_id": envelope.get("patient_id"),
        "resource_type": envelope.get("resource_type"),
        "resource_id": envelope.get("resource_id") or envelope.get("result_id"),
        "action": envelope.get("action"),
        "ip_address": envelope.get("ip_address"),
        "user_agent": envelope.get("user_agent"),
        "payload_hash": envelope.get("payload_hash"),
        "outcome": envelope.get("outcome") or "SUCCESS",
        "error_message": envelope.get("error_message"),
    }
    if not row["action"]:
        row.update(_AUTO_LOG_DEFAULTS.get(event_type, {"action": "UNKNOWN"}))
    return row


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
        row = envelope_to_audit_row(event_type, envelope)
        async with SessionLocal() as session:
            session.add(AuditEvent(**row))
            await session.commit()
        return True
    except Exception:
        logger.exception("Failed to persist audit event for stream %s", event_type)
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
