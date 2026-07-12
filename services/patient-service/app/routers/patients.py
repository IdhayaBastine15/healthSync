import hashlib
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from redis.asyncio import Redis
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user, get_redis
from app.db.session import get_db
from app.models.patient import Admission, Allergy, Medication, Patient
from app.schemas.patient import AdmissionOut, AllergyOut, MedicationOut, PatientCreate, PatientOut, PatientUpdate
from app.services.fhir import patient_to_fhir
from app.services.patient_cache import PatientCacheManager, admissions_key, allergies_key, meds_key, record_key
from app.streams.producer import StreamProducer

router = APIRouter(prefix="/patients", tags=["patients"])
settings = get_settings()

def _next_mrn() -> str:
    from datetime import datetime

    seq = uuid.uuid4().int % 1_000_000
    return f"MRN-{datetime.now().year}-{seq:06d}"


def _mask_sensitive(record: dict, user: CurrentUser) -> dict:
    if not user.has_permission("SENSITIVE_DATA"):
        record = dict(record)
        record.pop("ppsn_hash", None)
    return record


async def _log_view(redis: Redis, user: CurrentUser, request: Request, patient_id: str, action: str = "VIEW"):
    producer = StreamProducer(redis)
    await producer.produce(
        "audit.event.logged",
        "audit.event.logged",
        {
            "user_id": user.user_id,
            "user_role": user.roles[0] if user.roles else None,
            "patient_id": patient_id,
            "resource_type": "patient",
            "resource_id": patient_id,
            "action": action,
            "ip_address": request.client.host if request.client else None,
            "outcome": "SUCCESS",
        },
    )


@router.get("/search", response_model=list[PatientOut])
async def search_patients(
    q: str = Query(..., min_length=3),
    dob: str | None = None,
    limit: int = Query(20, le=20),
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
    request: Request = None,
):
    user.require("PATIENT_READ")
    stmt = select(Patient).where(
        or_(
            Patient.given_name.ilike(f"%{q}%"),
            Patient.family_name.ilike(f"%{q}%"),
            Patient.mrn.ilike(f"%{q}%"),
        )
    ).limit(limit)
    if dob:
        stmt = stmt.where(Patient.date_of_birth == dob)
    result = await db.execute(stmt)
    patients = result.scalars().all()

    producer = StreamProducer(redis)
    await producer.produce("audit.event.logged", "audit.event.logged", {
        "user_id": user.user_id, "action": "SEARCH", "resource_type": "patient",
        "payload_hash": hashlib.sha256(q.encode()).hexdigest(), "outcome": "SUCCESS",
    })
    return patients


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    user.require("PATIENT_WRITE")
    ppsn_hash = hashlib.sha256(body.ppsn.encode()).hexdigest() if body.ppsn else None
    patient = Patient(
        mrn=_next_mrn(),
        given_name=body.given_name,
        family_name=body.family_name,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        ppsn_hash=ppsn_hash,
        fhir_resource={},
    )
    patient.fhir_resource = patient_to_fhir(patient)
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("PATIENT_READ")
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail={"error": {"code": "PATIENT_NOT_FOUND", "message": f"No patient found with ID: {patient_id}"}})
    return patient


@router.get("/{patient_id}/record")
async def get_patient_record(
    patient_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    """Cached full record lookup — doc §4 request flow, §9 cache keys."""
    user.require("PATIENT_READ")
    cache = PatientCacheManager(redis)
    key = record_key(str(patient_id))

    cached = await cache.get(key)
    if cached:
        await _log_view(redis, user, request, str(patient_id))
        return _mask_sensitive({**cached, "_cache_hit": True}, user)

    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail={"error": {"code": "PATIENT_NOT_FOUND", "message": f"No patient found with ID: {patient_id}"}})

    meds = (await db.execute(select(Medication).where(Medication.patient_id == patient_id, Medication.status == "active"))).scalars().all()
    allergies = (await db.execute(select(Allergy).where(Allergy.patient_id == patient_id))).scalars().all()
    admissions = (await db.execute(select(Admission).where(Admission.patient_id == patient_id).order_by(Admission.admitted_at.desc()).limit(5))).scalars().all()

    record = {
        "demographics": PatientOut.model_validate(patient).model_dump(mode="json"),
        "medications": [MedicationOut.model_validate(m).model_dump(mode="json") for m in meds],
        "allergies": [AllergyOut.model_validate(a).model_dump(mode="json") for a in allergies],
        "admissions": [AdmissionOut.model_validate(a).model_dump(mode="json") for a in admissions],
        "ppsn_hash": patient.ppsn_hash,
        "_cache_hit": False,
    }
    await cache.set(key, record, settings.cache_ttl_seconds)
    await _log_view(redis, user, request, str(patient_id))
    return _mask_sensitive(record, user)


@router.get("/{patient_id}/medications", response_model=list[MedicationOut])
async def get_medications(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user), redis: Redis = Depends(get_redis)):
    user.require("PATIENT_READ")
    cache = PatientCacheManager(redis)
    key = meds_key(str(patient_id))
    cached = await cache.get(key)
    if cached is not None:
        return cached
    meds = (await db.execute(select(Medication).where(Medication.patient_id == patient_id))).scalars().all()
    out = [MedicationOut.model_validate(m).model_dump(mode="json") for m in meds]
    await cache.set(key, out, settings.cache_ttl_seconds)
    return out


@router.get("/{patient_id}/allergies", response_model=list[AllergyOut])
async def get_allergies(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user), redis: Redis = Depends(get_redis)):
    user.require("PATIENT_READ")
    cache = PatientCacheManager(redis)
    key = allergies_key(str(patient_id))
    cached = await cache.get(key)
    if cached is not None:
        return cached
    allergies = (await db.execute(select(Allergy).where(Allergy.patient_id == patient_id))).scalars().all()
    out = [AllergyOut.model_validate(a).model_dump(mode="json") for a in allergies]
    await cache.set(key, out, settings.cache_ttl_allergies_seconds)
    return out


@router.get("/{patient_id}/admissions", response_model=list[AdmissionOut])
async def get_admissions(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user), redis: Redis = Depends(get_redis)):
    user.require("PATIENT_READ")
    cache = PatientCacheManager(redis)
    key = admissions_key(str(patient_id))
    cached = await cache.get(key)
    if cached is not None:
        return cached
    admissions = (await db.execute(select(Admission).where(Admission.patient_id == patient_id).order_by(Admission.admitted_at.desc()))).scalars().all()
    out = [AdmissionOut.model_validate(a).model_dump(mode="json") for a in admissions]
    await cache.set(key, out, settings.cache_ttl_admissions_seconds)
    return out


@router.put("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: uuid.UUID,
    body: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    user.require("PATIENT_WRITE")
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail={"error": {"code": "PATIENT_NOT_FOUND", "message": f"No patient found with ID: {patient_id}"}})

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    patient.version += 1
    await db.commit()
    await db.refresh(patient)

    cache = PatientCacheManager(redis)
    await cache.invalidate_patient(str(patient_id))

    producer = StreamProducer(redis)
    await producer.produce("patient.record.updated", "patient.record.updated", {"patient_id": str(patient_id), "updated_by": user.user_id})

    return patient
