from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.patient_cache import PatientCacheManager, record_key


@pytest.mark.asyncio
async def test_cache_hit_returns_without_db_query():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = '{"id": "uuid-123", "given_name": "Test"}'

    cache = PatientCacheManager(mock_redis)
    result = await cache.get(record_key("uuid-123"))

    assert result["id"] == "uuid-123"


@pytest.mark.asyncio
async def test_cache_miss_returns_none():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    cache = PatientCacheManager(mock_redis)
    result = await cache.get(record_key("uuid-123"))

    assert result is None


@pytest.mark.asyncio
async def test_set_serialises_and_applies_ttl():
    mock_redis = AsyncMock()
    cache = PatientCacheManager(mock_redis)

    await cache.set(record_key("uuid-123"), {"id": "uuid-123"}, 300)

    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args.args
    assert args[0] == "patient:uuid-123:full_record"
    assert args[1] == 300


@pytest.mark.asyncio
async def test_invalidate_patient_deletes_all_related_keys():
    mock_redis = AsyncMock()
    pipe = AsyncMock()
    pipe.__aenter__.return_value = pipe
    mock_redis.pipeline = MagicMock(return_value=pipe)

    cache = PatientCacheManager(mock_redis)
    await cache.invalidate_patient("uuid-123")

    assert pipe.delete.call_count == 4
    pipe.execute.assert_called_once()
