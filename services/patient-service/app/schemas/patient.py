import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import RBAC


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


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    given_name: str = Field(min_length=1, max_length=200)
    family_name: str = Field(min_length=1, max_length=200)
    roles: list[str] = Field(min_length=1)
    department: str | None = None

    @field_validator("roles")
    @classmethod
    def _roles_must_be_known(cls, v: list[str]) -> list[str]:
        # No admin-approval step exists (see patient-service/README.md's
        # "Self-signup" section for why) - this is the only gate stopping a
        # signup from claiming a role outside shared/rbac.json's list.
        unknown = set(v) - set(RBAC.get("roles", []))
        if unknown:
            raise ValueError(f"Unknown role(s): {', '.join(sorted(unknown))}")
        return v


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
