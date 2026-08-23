"""Seed realistic demo data: patients (+ medications/allergies/admissions),
lab results (+ observations), audit trail, and analytics rows - so the
frontend and analytics dashboard aren't empty for an end-to-end demo.

Bypasses the services' HTTP APIs and Redis Streams entirely (this is a lot
of historical, backdated data - the APIs always stamp "now") and writes
directly to Postgres instead, across all four schemas in one transaction
per patient. That means analytics.lab_turnaround and audit.audit_events
rows are inserted by hand here to match what analytics-service's and
audit-service's consumers would have produced had these events gone
through Redis Streams for real - see shared/EVENTS.md.

Idempotent per patient: each patient gets a fixed MRN (MRN-2026-100001..).
A patient whose MRN already exists is skipped entirely (including its
lab results/meds/etc) rather than re-seeded, so running this twice against
the same database doesn't duplicate data. Also seeds the same demo users as
`db_bootstrap.py seed-demo` (idempotent via ON CONFLICT) since lab results
and audit rows need real user ids to attribute actions to.

Usage:
    DATABASE_URL=postgresql://user:pass@host/db \
      services/patient-service/.venv/bin/python scripts/seed_mock_data.py
"""
import asyncio
import hashlib
import json
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

import asyncpg

sys.path.insert(0, os.path.dirname(__file__))
from db_bootstrap import DEMO_PASSWORD, DEMO_USERS, seed_user, to_pg_dsn  # noqa: E402

random.seed(42)

WARDS = ["Cardiology", "General Medicine", "Emergency", "Orthopaedics", "ICU", "Paediatrics"]
DRUGS = [
    ("Metformin", "500mg", "twice daily", "oral"),
    ("Amlodipine", "5mg", "once daily", "oral"),
    ("Atorvastatin", "20mg", "once daily", "oral"),
    ("Salbutamol", "100mcg", "as needed", "inhaled"),
    ("Warfarin", "3mg", "once daily", "oral"),
]
ALLERGIES = [
    ("Penicillin", "rash", "moderate"),
    ("Latex", "contact dermatitis", "mild"),
    ("Peanuts", "anaphylaxis", "life-threatening"),
    ("Ibuprofen", "gastric upset", "mild"),
]
GIVEN_NAMES = ["Cian", "Sinead", "Aoife", "Liam", "Roisin", "Sean", "Niamh", "Padraig", "Orla", "Fionn"]
FAMILY_NAMES = ["Murphy", "Kelly", "O'Brien", "Ryan", "Walsh", "Byrne", "Doyle", "Kennedy", "Lynch", "Hughes"]

REFERENCE_RANGES = {
    "potassium": {"low": 3.5, "high": 5.0, "unit": "mmol/L"},
    "sodium": {"low": 135, "high": 145, "unit": "mmol/L"},
    "haemoglobin": {"low": 12.0, "high": 17.5, "unit": "g/dL"},
    "troponin": {"low": 0.0, "high": 0.04, "unit": "ng/mL"},
    "glucose": {"low": 4.0, "high": 7.8, "unit": "mmol/L"},
    "creatinine": {"low": 60, "high": 110, "unit": "umol/L"},
}
PANELS = [
    ("BMP", "Basic Metabolic Panel", ["sodium", "potassium", "creatinine", "glucose"]),
    ("FBC", "Full Blood Count", ["haemoglobin"]),
    ("CARDIAC", "Cardiac Panel", ["troponin"]),
]

NOW = datetime.now(timezone.utc)


def _rand_value(code: str, critical: bool) -> float:
    r = REFERENCE_RANGES[code]
    if critical:
        return r["high"] * random.uniform(1.5, 2.5) if random.random() < 0.5 else r["low"] * random.uniform(0.2, 0.5)
    return round(random.uniform(r["low"], r["high"]), 2)


def _interpretation(code: str, value: float) -> str:
    r = REFERENCE_RANGES[code]
    if value < r["low"] * 0.6:
        return "critical-low"
    if value > r["high"] * 1.4:
        return "critical-high"
    if value < r["low"]:
        return "low"
    if value > r["high"]:
        return "high"
    return "normal"


async def ensure_demo_users(dsn: str, conn: asyncpg.Connection) -> dict[str, uuid.UUID]:
    for u in DEMO_USERS:
        await seed_user(dsn, u["email"], DEMO_PASSWORD, u["given_name"], u["family_name"], u["roles"])
    rows = await conn.fetch("SELECT id, email FROM patient.users WHERE email = ANY($1)", [u["email"] for u in DEMO_USERS])
    return {row["email"]: row["id"] for row in rows}


def patient_fhir(patient_id: uuid.UUID, mrn: str, given: str, family: str, dob: date, gender: str) -> dict:
    return {
        "resourceType": "Patient",
        "id": str(patient_id),
        "meta": {"versionId": "1", "lastUpdated": NOW.isoformat(), "source": "healthsync://patient-service"},
        "identifier": [{"system": "urn:oid:healthsync:mrn", "value": mrn}],
        "active": True,
        "name": [{"use": "official", "family": family, "given": [given]}],
        "gender": gender,
        "birthDate": dob.isoformat(),
    }


def result_fhir(result_id: uuid.UUID, patient_id: uuid.UUID, status: str, report_code: str, report_display: str, effective_at: datetime, issued_at: datetime, obs_ids: list[uuid.UUID]) -> dict:
    return {
        "resourceType": "DiagnosticReport",
        "id": str(result_id),
        "status": status,
        "code": {"coding": [{"code": report_code, "display": report_display}]},
        "subject": {"reference": f"Patient/{patient_id}"},
        "effectiveDateTime": effective_at.isoformat(),
        "issued": issued_at.isoformat(),
        "result": [{"reference": f"Observation/{oid}"} for oid in obs_ids],
    }


async def seed_patient(conn: asyncpg.Connection, index: int, users: dict[str, uuid.UUID]) -> None:
    mrn = f"MRN-2026-{100001 + index}"
    given, family = GIVEN_NAMES[index], FAMILY_NAMES[index]
    dob = date(random.randint(1945, 2010), random.randint(1, 12), random.randint(1, 28))
    gender = random.choice(["male", "female"])
    patient_id = uuid.uuid4()
    doctor_id = users["doctor@healthsync.ie"]
    nurse_id = users["nurse@healthsync.ie"]
    labtech_id = users["labtech@healthsync.ie"]
    admin_id = users["admin@healthsync.ie"]

    row = await conn.fetchrow(
        """
        INSERT INTO patient.patients (id, mrn, fhir_resource, given_name, family_name, date_of_birth, gender, is_active, created_by)
        VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, true, $8)
        ON CONFLICT (mrn) DO NOTHING
        RETURNING id
        """,
        patient_id, mrn, json.dumps(patient_fhir(patient_id, mrn, given, family, dob, gender)), given, family, dob, gender, admin_id,
    )
    if row is None:
        print(f"  {mrn} already exists, skipping")
        return

    # --- medications (1-2) ---
    for drug_name, dose, freq, route in random.sample(DRUGS, k=random.randint(1, 2)):
        start = NOW - timedelta(days=random.randint(10, 365))
        await conn.execute(
            """
            INSERT INTO patient.medications (patient_id, drug_name, dose, frequency, route, status, prescribed_by, start_date)
            VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
            """,
            patient_id, drug_name, dose, freq, route, doctor_id, start.date(),
        )

    # --- allergies (0-2) ---
    for substance, reaction, severity in random.sample(ALLERGIES, k=random.randint(0, 2)):
        await conn.execute(
            "INSERT INTO patient.allergies (patient_id, substance, reaction, severity, verified_by) VALUES ($1, $2, $3, $4, $5)",
            patient_id, substance, reaction, severity, nurse_id,
        )

    # --- admission (1) ---
    admitted_at = NOW - timedelta(days=random.randint(1, 20), hours=random.randint(0, 23))
    discharged_at = admitted_at + timedelta(days=random.randint(1, 5)) if random.random() < 0.6 else None
    await conn.execute(
        "INSERT INTO patient.admissions (patient_id, ward, admitted_at, discharged_at, reason, care_team) VALUES ($1, $2, $3, $4, $5, $6)",
        patient_id, random.choice(WARDS), admitted_at, discharged_at, "Routine admission", [doctor_id, nurse_id],
    )

    # --- record_access_log (2-4 views over the last week, doc §6 patient-volume proxy) ---
    for _ in range(random.randint(2, 4)):
        await conn.execute(
            "INSERT INTO analytics.record_access_log (patient_id, accessed_at) VALUES ($1, $2)",
            patient_id, NOW - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23)),
        )

    # --- lab results (3), mix of critical/normal, some acknowledged ---
    for i in range(3):
        report_code, report_display, codes = PANELS[i % len(PANELS)]
        is_critical = random.random() < 0.25
        filed_at = NOW - timedelta(days=random.randint(0, 14), hours=random.randint(0, 23))
        issued_at = filed_at
        effective_at = filed_at - timedelta(hours=1)
        result_id = uuid.uuid4()
        result_hash = hashlib.sha256(f"{patient_id}-{report_code}-{i}".encode()).hexdigest()

        obs_rows = []
        for code in codes:
            value = _rand_value(code, is_critical)
            obs_rows.append((uuid.uuid4(), code, value, REFERENCE_RANGES[code]["unit"], _interpretation(code, value)))

        acknowledged = random.random() < 0.6
        acknowledged_by = doctor_id if acknowledged else None
        acknowledged_at = filed_at + timedelta(minutes=random.randint(5, 240)) if acknowledged else None

        fhir = result_fhir(result_id, patient_id, "final", report_code, report_display, effective_at, issued_at, [o[0] for o in obs_rows])
        await conn.execute(
            """
            INSERT INTO lab.lab_results
                (id, patient_id, fhir_resource, report_code, report_display, status, is_critical,
                 acknowledged_by, acknowledged_at, source_system, result_hash, effective_at, issued_at)
            VALUES ($1, $2, $3::jsonb, $4, $5, 'final', $6, $7, $8, 'seed-mock-data', $9, $10, $11)
            """,
            result_id, patient_id, json.dumps(fhir), report_code, report_display, is_critical,
            acknowledged_by, acknowledged_at, result_hash, effective_at, issued_at,
        )
        for obs_id, code, value, unit, interp in obs_rows:
            r = REFERENCE_RANGES[code]
            await conn.execute(
                """
                INSERT INTO lab.observations
                    (id, result_id, patient_id, loinc_code, display_name, value_quantity, unit, reference_low, reference_high, interpretation)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                obs_id, result_id, patient_id, code, code.capitalize(), value, unit, r["low"], r["high"], interp,
            )

        ttl_ack = int((acknowledged_at - filed_at).total_seconds()) if acknowledged_at else None
        await conn.execute(
            """
            INSERT INTO analytics.lab_turnaround (result_id, patient_id, filed_at, acknowledged_at, is_critical, time_to_acknowledge_seconds)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            result_id, patient_id, filed_at, acknowledged_at, is_critical, ttl_ack,
        )

        await conn.execute(
            """
            INSERT INTO audit.audit_events (event_type, user_id, user_role, patient_id, resource_type, resource_id, action, outcome, created_at)
            VALUES ('lab.result.filed', $1, 'LAB_TECH', $2, 'lab_result', $3, 'CREATE', 'SUCCESS', $4)
            """,
            labtech_id, patient_id, result_id, filed_at,
        )
        if is_critical:
            await conn.execute(
                """
                INSERT INTO audit.audit_events (event_type, user_id, user_role, patient_id, resource_type, resource_id, action, outcome, created_at)
                VALUES ('lab.result.critical', $1, 'LAB_TECH', $2, 'lab_result', $3, 'CRITICAL_ALERT', 'SUCCESS', $4)
                """,
                labtech_id, patient_id, result_id, filed_at,
            )
        if acknowledged:
            await conn.execute(
                """
                INSERT INTO audit.audit_events (event_type, user_id, user_role, patient_id, resource_type, resource_id, action, outcome, created_at)
                VALUES ('lab.result.acknowledged', $1, 'DOCTOR', $2, 'lab_result', $3, 'ACKNOWLEDGE', 'SUCCESS', $4)
                """,
                doctor_id, patient_id, result_id, acknowledged_at,
            )

    # --- a few VIEW/SEARCH audit rows against this patient ---
    for _ in range(random.randint(1, 3)):
        await conn.execute(
            """
            INSERT INTO audit.audit_events (event_type, user_id, user_role, patient_id, resource_type, resource_id, action, outcome, created_at)
            VALUES ('audit.event.logged', $1, 'DOCTOR', $2, 'patient', $2, 'VIEW', 'SUCCESS', $3)
            """,
            doctor_id, patient_id, NOW - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23)),
        )

    print(f"  seeded {mrn} ({given} {family}) with meds/allergies/admission/3 lab results")


async def seed_login_history(conn: asyncpg.Connection, users: dict[str, uuid.UUID]) -> None:
    for email, user_id in users.items():
        existing = await conn.fetchval(
            "SELECT count(*) FROM audit.audit_events WHERE user_id = $1 AND action = 'LOGIN'", user_id
        )
        if existing:
            print(f"  {email} already has login history, skipping")
            continue
        role = next(u["roles"][0] for u in DEMO_USERS if u["email"] == email)
        for _ in range(random.randint(2, 5)):
            await conn.execute(
                """
                INSERT INTO audit.audit_events (event_type, user_id, user_role, resource_type, action, outcome, created_at)
                VALUES ('audit.event.logged', $1, $2, 'auth', 'LOGIN', 'SUCCESS', $3)
                """,
                user_id, role, NOW - timedelta(days=random.randint(0, 14), hours=random.randint(0, 23)),
            )


async def main() -> None:
    dsn = to_pg_dsn(os.environ.get("DATABASE_URL", ""))
    if not dsn:
        print("DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    print("Ensuring demo users exist...")
    conn = await asyncpg.connect(dsn)
    try:
        users = await ensure_demo_users(dsn, conn)
        print(f"Seeding {len(GIVEN_NAMES)} demo patients (MRN-2026-100001..{100000 + len(GIVEN_NAMES)})...")
        for i in range(len(GIVEN_NAMES)):
            async with conn.transaction():
                await seed_patient(conn, i, users)
        print("Seeding login history...")
        async with conn.transaction():
            await seed_login_history(conn, users)
    finally:
        await conn.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
