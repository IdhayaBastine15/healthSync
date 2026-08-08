import uuid
from datetime import datetime, timezone
from ipaddress import IPv4Address

from app.schemas.audit import AuditEventOut


class TestAuditEventOutIpAddress:
    def _base_kwargs(self, ip_address):
        return dict(
            id=uuid.uuid4(),
            event_type="audit.event.logged",
            user_id=uuid.uuid4(),
            user_role="DOCTOR",
            patient_id=None,
            resource_type="auth",
            resource_id=None,
            action="LOGIN",
            ip_address=ip_address,
            outcome="SUCCESS",
            created_at=datetime.now(timezone.utc),
        )

    def test_stringifies_ipaddress_object(self):
        # asyncpg decodes an INET column to ipaddress.IPv4Address, not str -
        # the response model must coerce it or serialization 500s (regression
        # for the /audit/events endpoint failing on any row with an IP set).
        out = AuditEventOut(**self._base_kwargs(IPv4Address("185.15.59.224")))
        assert out.ip_address == "185.15.59.224"
        assert isinstance(out.ip_address, str)

    def test_passes_through_plain_string(self):
        out = AuditEventOut(**self._base_kwargs("10.0.0.1"))
        assert out.ip_address == "10.0.0.1"

    def test_passes_through_none(self):
        out = AuditEventOut(**self._base_kwargs(None))
        assert out.ip_address is None
