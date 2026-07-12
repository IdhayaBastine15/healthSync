import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ObservationIn(BaseModel):
    loinc_code: str
    display_name: str
    value_quantity: float | None = None
    value_string: str | None = None
    unit: str | None = None
    reference_low: float | None = None
    reference_high: float | None = None


class LabResultCreate(BaseModel):
    patient_id: uuid.UUID
    report_code: str
    report_display: str | None = None
    status: str = "final"
    source_system: str
    effective_at: datetime
    issued_at: datetime
    observations: list[ObservationIn] = Field(default_factory=list)


class ObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    loinc_code: str
    display_name: str
    value_quantity: float | None
    value_string: str | None
    unit: str | None
    reference_low: float | None
    reference_high: float | None
    interpretation: str | None


class LabResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    report_code: str
    report_display: str | None
    status: str
    is_critical: bool
    acknowledged_by: uuid.UUID | None
    acknowledged_at: datetime | None
    source_system: str
    effective_at: datetime
    issued_at: datetime


class LabResultDetail(LabResultOut):
    observations: list[ObservationOut] = Field(default_factory=list)


class AcknowledgeRequest(BaseModel):
    note: str | None = None
