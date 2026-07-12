import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class PatientCreate(BaseModel):
    given_name: str
    family_name: str
    date_of_birth: date
    gender: str | None = None
    ppsn: str | None = None
    address_country: str = "IE"
    address_postal_code: str | None = None


class PatientUpdate(BaseModel):
    given_name: str | None = None
    family_name: str | None = None
    gender: str | None = None
    is_active: bool | None = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mrn: str
    given_name: str
    family_name: str
    date_of_birth: date
    gender: str | None
    is_active: bool


class MedicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    drug_name: str
    dose: str | None
    frequency: str | None
    route: str | None
    status: str
    start_date: date
    end_date: date | None
    stop_reason: str | None


class AllergyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    substance: str
    reaction: str | None
    severity: str | None


class AdmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ward: str
    admitted_at: datetime
    discharged_at: datetime | None
    reason: str | None
