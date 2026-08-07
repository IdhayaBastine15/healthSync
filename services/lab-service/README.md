# lab-service

Python 3.11 · FastAPI · SQLAlchemy (async) · PostgreSQL (`lab` schema) · Redis

Owns lab results and observations. Verifies JWTs issued by patient-service
(holds only the RSA public key — never issues tokens itself).

## Endpoints

```
POST   /results                              → file a new result (from a LIS); dedups retries, flags critical values
GET    /results/{result_id}                  → result + its observations
GET    /results/patient/{patient_id}         → all results for a patient
GET    /results/patient/{patient_id}/recent  → last 10
PUT    /results/{result_id}/acknowledge      → clinician acknowledges a critical result
GET    /panels                               → available test panels (BMP, FBC, Cardiac)
GET    /reference-ranges/{test_code}         → normal reference range for a LOINC-ish test code
GET    /health
GET    /metrics                              → Prometheus
```

RBAC (`shared/rbac.json`): `RESULT_READ`, `RESULT_FILE` (LAB_TECH/ADMIN only),
`RESULT_ACKNOWLEDGE`.

## Critical-value detection (`app/services/critical.py`)

Hardcoded thresholds for potassium, sodium, haemoglobin, troponin, glucose,
creatinine (doc §5). Any observation outside its threshold marks the whole
result `is_critical: true` and fires `lab.result.critical` in addition to
`lab.result.filed`.

## Duplicate detection (`app/services/dedup.py`)

LIS systems retry on timeout. `POST /results` hashes
`patient_id:report_code:source_system:issued_at` and rejects a repeat within a
24h window (`dedup_ttl_seconds`) with `409 DUPLICATE_RESULT`. The dedup key is
claimed in Redis *before* the DB write and explicitly released if the write
fails, so a transient DB error doesn't permanently lock out a legitimate retry.

## Events produced (`shared/EVENTS.md`)

- `lab.result.filed` — every successful `POST /results`
- `lab.result.critical` — when any observation trips a critical threshold
- `lab.result.acknowledged` — on `PUT /results/{id}/acknowledge`
- `audit.event.logged` — on file and acknowledge

## Run standalone

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
JWT_PUBLIC_KEY_PATH=../../shared/keys/jwt_public.pem \
  .venv/bin/uvicorn app.main:app --reload --port 8002
```

## Test

```bash
.venv/bin/python -m pytest
```
