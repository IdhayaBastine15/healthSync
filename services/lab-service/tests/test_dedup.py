from datetime import datetime, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.schemas.lab import LabResultCreate
from app.services.dedup import compute_result_hash, is_duplicate


def _sample_result() -> LabResultCreate:
    return LabResultCreate(
        patient_id=uuid4(),
        report_code="BMP",
        source_system="LIS-TRIAS",
        effective_at=datetime.now(timezone.utc),
        issued_at=datetime.now(timezone.utc),
    )


class TestComputeResultHash:
    def test_same_input_produces_same_hash(self):
        body = _sample_result()
        assert compute_result_hash(body) == compute_result_hash(body)

    def test_different_patient_produces_different_hash(self):
        a, b = _sample_result(), _sample_result()
        assert compute_result_hash(a) != compute_result_hash(b)


class TestIsDuplicate:
    @pytest.mark.asyncio
    async def test_first_submission_is_not_duplicate(self):
        mock_redis = AsyncMock()
        mock_redis.exists.return_value = False

        result = await is_duplicate("hash-123", mock_redis)

        assert result is False
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_repeat_submission_is_duplicate(self):
        mock_redis = AsyncMock()
        mock_redis.exists.return_value = True

        result = await is_duplicate("hash-123", mock_redis)

        assert result is True
        mock_redis.setex.assert_not_called()
