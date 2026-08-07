# patient-service

Python 3.11 · FastAPI · SQLAlchemy (async) · PostgreSQL (`patient` schema) · Redis

Owns patient demographics, medications, allergies, and admissions. Issues and
verifies the JWTs every other service trusts (it holds the RSA private key;
everyone else only has the public key).

## Endpoints

```
POST   /auth/login                       → issue access + refresh token
POST   /auth/refresh                     → exchange refresh token for a new access token
POST   /auth/logout                      → blacklist the current access token (jti) in Redis
POST   /patients                         → create patient (generates MRN, FHIR Patient resource)
GET    /patients/search?q=&dob=          → search by name/MRN (+ optional DOB filter)
GET    /patients/{id}                    → demographics only
GET    /patients/{id}/record             → full record (demographics + meds + allergies + admissions), Redis-cached
GET    /patients/{id}/medications        → Redis-cached
GET    /patients/{id}/allergies          → Redis-cached
GET    /patients/{id}/admissions         → Redis-cached
PUT    /patients/{id}                    → update; invalidates cache, emits patient.record.updated
GET    /health
GET    /metrics                          → Prometheus
```

RBAC (`shared/rbac.json`): `PATIENT_READ`, `PATIENT_WRITE`, `SENSITIVE_DATA`
(gates whether `ppsn_hash` is included in the record response).

## Events produced (`shared/EVENTS.md`)

- `audit.event.logged` — on login, search, view, create
- `patient.record.updated` — on any `PUT /patients/{id}`

## Caching

`app/services/patient_cache.py` — full record (5 min TTL), medications (5
min), allergies (1h — changes rarely), admissions (10 min). All four keys are
invalidated together on any patient update.

## Run standalone

```bash
uv venv --python 3.12 .venv   # see project memory: system python3 may be too new for pydantic-core wheels
uv pip install --python .venv/bin/python -r requirements.txt
JWT_PRIVATE_KEY_PATH=../../shared/keys/jwt_private.pem \
JWT_PUBLIC_KEY_PATH=../../shared/keys/jwt_public.pem \
  .venv/bin/uvicorn app.main:app --reload --port 8001
```

## Test

```bash
.venv/bin/python -m pytest
```
