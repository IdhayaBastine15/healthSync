import json
from datetime import datetime, timezone
from uuid import uuid4

from redis.asyncio import Redis


class StreamProducer:
    """Redis Streams producer — the free-tier stand-in for the Kafka
    producer in the architecture doc (§8). Same envelope shape, same
    partition-key-by-patient_id ordering guarantee (a single stream key
    already totally orders entries; we don't need Kafka's partition count
    to get per-patient ordering at this scale).
    """

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
        entry_id = await self.redis.xadd(f"stream:{stream}", {"data": json.dumps(envelope, default=str)})
        return entry_id
