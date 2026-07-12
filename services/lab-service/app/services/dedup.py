import hashlib

from redis.asyncio import Redis

from app.core.config import get_settings
from app.schemas.lab import LabResultCreate


def compute_result_hash(body: LabResultCreate) -> str:
    """Stable hash of the fields that make a LIS retry identical to the original POST."""
    raw = f"{body.patient_id}:{body.report_code}:{body.source_system}:{body.issued_at.isoformat()}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def is_duplicate(result_hash: str, redis: Redis) -> bool:
    """Prevent duplicate lab results from LIS retries (24h dedup window)."""
    key = f"lab:result:hash:{result_hash}"
    if await redis.exists(key):
        return True
    await redis.setex(key, get_settings().dedup_ttl_seconds, "1")
    return False
