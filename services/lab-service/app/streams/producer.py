import json
from datetime import datetime, timezone
from uuid import uuid4

from redis.asyncio import Redis


class StreamProducer:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def produce(self, stream: str, event_type: str, payload: dict, correlation_id: str | None = None) -> str:
        envelope = {
            "event_id": str(uuid4()),
            "event_type": event_type,
            "schema_version": "1.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "correlation_id": correlation_id,
            **payload,
        }
        return await self.redis.xadd(f"stream:{stream}", {"data": json.dumps(envelope, default=str)})
