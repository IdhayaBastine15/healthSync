from datetime import datetime, timezone

from app.services.consumer import compute_ack_seconds, parse_timestamp


class TestParseTimestamp:
    def test_parses_iso_envelope_timestamp(self):
        envelope = {"timestamp": "2026-07-07T10:30:00+00:00"}
        assert parse_timestamp(envelope) == datetime(2026, 7, 7, 10, 30, 0, tzinfo=timezone.utc)


class TestComputeAckSeconds:
    def test_computes_positive_gap(self):
        filed = datetime(2026, 7, 7, 10, 0, 0, tzinfo=timezone.utc)
        acknowledged = datetime(2026, 7, 7, 10, 5, 30, tzinfo=timezone.utc)
        assert compute_ack_seconds(filed, acknowledged) == 330

    def test_clamps_negative_gap_to_zero(self):
        # Out-of-order delivery could hand the consumer an acknowledged
        # timestamp earlier than filed_at - never report negative TAT.
        filed = datetime(2026, 7, 7, 10, 5, 0, tzinfo=timezone.utc)
        acknowledged = datetime(2026, 7, 7, 10, 0, 0, tzinfo=timezone.utc)
        assert compute_ack_seconds(filed, acknowledged) == 0
