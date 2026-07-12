import json

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()


def record_key(patient_id: str) -> str:
    return f"patient:{patient_id}:full_record"


def meds_key(patient_id: str) -> str:
    return f"patient:{patient_id}:medications"


def allergies_key(patient_id: str) -> str:
    return f"patient:{patient_id}:allergies"


def admissions_key(patient_id: str) -> str:
    return f"patient:{patient_id}:admissions"


class PatientCacheManager:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def get(self, key: str) -> dict | None:
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None

    async def set(self, key: str, value, ttl: int) -> None:
        await self.redis.setex(key, ttl, json.dumps(value, default=str))

    async def invalidate_patient(self, patient_id: str) -> None:
        keys = [record_key(patient_id), meds_key(patient_id), allergies_key(patient_id), admissions_key(patient_id)]
        async with self.redis.pipeline() as pipe:
            for key in keys:
                pipe.delete(key)
            await pipe.execute()
