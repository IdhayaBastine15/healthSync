import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class LabTurnaroundOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    result_id: uuid.UUID
    patient_id: uuid.UUID
    filed_at: datetime
    acknowledged_at: datetime | None
    is_critical: bool
    time_to_acknowledge_seconds: int | None


class DashboardOut(BaseModel):
    results_filed_total: int
    results_pending_acknowledgement: int
    critical_alerts_total: int
    avg_time_to_acknowledge_seconds: float | None
    avg_critical_time_to_acknowledge_seconds: float | None
    record_updates_last_24h: int


class LabTurnaroundReportOut(BaseModel):
    date_range: dict[str, str]
    total_results: int
    avg_time_to_acknowledge_seconds: float | None
    results: list[LabTurnaroundOut]


class CriticalAlertsReportOut(BaseModel):
    date_range: dict[str, str]
    total_critical_alerts: int
    acknowledged_count: int
    avg_time_to_acknowledge_seconds: float | None
    alerts: list[LabTurnaroundOut]


class PatientVolumeDay(BaseModel):
    day: date
    record_updates: int


class StreamLag(BaseModel):
    stream: str
    length: int
    pending: int


class SystemHealthOut(BaseModel):
    consumer_group: str
    streams: list[StreamLag]
