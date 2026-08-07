import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import CurrentUser, get_current_user, get_redis
from app.db.session import get_db
from app.models.lab import LabResult, Observation
from app.schemas.lab import AcknowledgeRequest, LabResultCreate, LabResultDetail, LabResultOut
from app.services.critical import interpret, is_critical
from app.services.dedup import compute_result_hash, is_duplicate
from app.services.fhir import result_to_fhir
from app.streams.producer import StreamProducer

router = APIRouter(tags=["results"])

CRITICAL_THRESHOLD_TEST_CODES = {"potassium", "sodium", "haemoglobin", "troponin", "glucose", "creatinine"}

REFERENCE_RANGES = {
    "potassium":   {"low": 3.5, "high": 5.0, "unit": "mmol/L"},
    "sodium":      {"low": 135, "high": 145, "unit": "mmol/L"},
    "haemoglobin": {"low": 12.0, "high": 17.5, "unit": "g/dL"},
    "troponin":    {"low": 0.0, "high": 0.04, "unit": "ng/mL"},
    "glucose":     {"low": 4.0, "high": 7.8, "unit": "mmol/L"},
    "creatinine":  {"low": 60, "high": 110, "unit": "umol/L"},
}

PANELS = [
    {"code": "BMP", "display": "Basic Metabolic Panel", "tests": ["sodium", "potassium", "creatinine", "glucose"]},
    {"code": "FBC", "display": "Full Blood Count", "tests": ["haemoglobin"]},
    {"code": "CARDIAC", "display": "Cardiac Panel", "tests": ["troponin"]},
]


async def _log_audit(redis: Redis, user: CurrentUser, request: Request, patient_id: str, resource_id: str, action: str):
    producer = StreamProducer(redis)
    await producer.produce(
        "audit.event.logged",
        "audit.event.logged",
        {
            "user_id": user.user_id,
            "user_role": user.roles[0] if user.roles else None,
            "patient_id": patient_id,
            "resource_type": "lab_result",
            "resource_id": resource_id,
            "action": action,
            "ip_address": request.client.host if request.client else None,
            "outcome": "SUCCESS",
        },
    )


@router.post("/results", response_model=LabResultDetail, status_code=status.HTTP_201_CREATED)
async def file_result(
    body: LabResultCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    user.require("RESULT_FILE")

    result_hash = compute_result_hash(body)
    if await is_duplicate(result_hash, redis):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"error": {"code": "DUPLICATE_RESULT", "message": "This result was already filed (LIS retry detected)"}})

    result_critical = False
    observations: list[Observation] = []
    for obs_in in body.observations:
        obs_critical = obs_in.value_quantity is not None and is_critical(obs_in.loinc_code, obs_in.value_quantity)
        result_critical = result_critical or obs_critical
        interpretation = (
            interpret(obs_in.loinc_code, obs_in.value_quantity, obs_in.reference_low, obs_in.reference_high)
            if obs_in.value_quantity is not None
            else None
        )
        observations.append(
            Observation(
                patient_id=body.patient_id,
                loinc_code=obs_in.loinc_code,
                display_name=obs_in.display_name,
                value_quantity=obs_in.value_quantity,
                value_string=obs_in.value_string,
                unit=obs_in.unit,
                reference_low=obs_in.reference_low,
                reference_high=obs_in.reference_high,
                interpretation=interpretation,
            )
        )

    result = LabResult(
        patient_id=body.patient_id,
        fhir_resource={},
        report_code=body.report_code,
        report_display=body.report_display,
        status=body.status,
        is_critical=result_critical,
        source_system=body.source_system,
        result_hash=result_hash,
        effective_at=body.effective_at,
        issued_at=body.issued_at,
    )
    try:
        db.add(result)
        await db.flush()
        for obs in observations:
            obs.result_id = result.id
            db.add(obs)
        await db.flush()

        result.fhir_resource = result_to_fhir(result, observations)
        await db.commit()
    except Exception:
        # Release the dedup claim so a retry after a transient DB failure isn't
        # permanently treated as a duplicate for the rest of the 24h window.
        await redis.delete(f"lab:result:hash:{result_hash}")
        raise
    await db.refresh(result)

    producer = StreamProducer(redis)
    await producer.produce("lab.result.filed", "lab.result.filed", {"patient_id": str(result.patient_id), "result_id": str(result.id), "is_critical": result_critical})
    if result_critical:
        await producer.produce("lab.result.critical", "lab.result.critical", {"patient_id": str(result.patient_id), "result_id": str(result.id), "severity": "CRITICAL"})
    await _log_audit(redis, user, request, str(result.patient_id), str(result.id), "CREATE")

    return LabResultDetail(**LabResultOut.model_validate(result).model_dump(), observations=observations)


@router.get("/results/patient/{patient_id}/recent", response_model=list[LabResultOut])
async def get_recent_results(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("RESULT_READ")
    stmt = select(LabResult).where(LabResult.patient_id == patient_id).order_by(LabResult.issued_at.desc()).limit(10)
    results = (await db.execute(stmt)).scalars().all()
    return results


@router.get("/results/patient/{patient_id}", response_model=list[LabResultOut])
async def get_patient_results(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("RESULT_READ")
    stmt = select(LabResult).where(LabResult.patient_id == patient_id).order_by(LabResult.issued_at.desc())
    results = (await db.execute(stmt)).scalars().all()
    return results


@router.get("/results/{result_id}", response_model=LabResultDetail)
async def get_result(result_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    user.require("RESULT_READ")
    result = await db.get(LabResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail={"error": {"code": "RESULT_NOT_FOUND", "message": f"No lab result found with ID: {result_id}"}})
    observations = (await db.execute(select(Observation).where(Observation.result_id == result_id))).scalars().all()
    return LabResultDetail(**LabResultOut.model_validate(result).model_dump(), observations=[o for o in observations])


@router.put("/results/{result_id}/acknowledge", response_model=LabResultOut)
async def acknowledge_result(
    result_id: uuid.UUID,
    body: AcknowledgeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    user.require("RESULT_ACKNOWLEDGE")
    result = await db.get(LabResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail={"error": {"code": "RESULT_NOT_FOUND", "message": f"No lab result found with ID: {result_id}"}})

    from datetime import datetime, timezone

    result.acknowledged_by = uuid.UUID(user.user_id)
    result.acknowledged_at = datetime.now(timezone.utc)
    result.acknowledge_note = body.note
    await db.commit()
    await db.refresh(result)

    producer = StreamProducer(redis)
    await producer.produce(
        "lab.result.acknowledged",
        "lab.result.acknowledged",
        {"patient_id": str(result.patient_id), "result_id": str(result.id), "acknowledged_by": user.user_id},
    )
    await _log_audit(redis, user, request, str(result.patient_id), str(result.id), "ACKNOWLEDGE")

    return result


@router.get("/panels")
async def get_panels(user: CurrentUser = Depends(get_current_user)):
    user.require("RESULT_READ")
    return PANELS


@router.get("/reference-ranges/{test_code}")
async def get_reference_range(test_code: str, user: CurrentUser = Depends(get_current_user)):
    user.require("RESULT_READ")
    range_ = REFERENCE_RANGES.get(test_code)
    if not range_:
        raise HTTPException(status_code=404, detail={"error": {"code": "TEST_CODE_NOT_FOUND", "message": f"No reference range for test code: {test_code}"}})
    return {"test_code": test_code, **range_}
