import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    user_id: uuid.UUID | None
    user_role: str | None
    patient_id: uuid.UUID | None
    resource_type: str | None
    resource_id: uuid.UUID | None
    action: str
    ip_address: str | None
    outcome: str | None
    created_at: datetime

    @field_validator("ip_address", mode="before")
    @classmethod
    def _stringify_ip(cls, v: object) -> str | None:
        # asyncpg decodes the INET column to ipaddress.IPv4Address/IPv6Address
        # regardless of the SQLAlchemy column type annotation.
        return None if v is None else str(v)
