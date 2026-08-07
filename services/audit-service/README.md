# audit-service

Python 3.11 · FastAPI · SQLAlchemy (async) · PostgreSQL (`audit` schema, append-only) · Redis

Doesn't receive writes via its own API — it's a passive consumer that ingests
events from every other service's Redis Streams and persists them as an
immutable audit trail. The `audit.prevent_mutation()` Postgres trigger
(`shared/sql/001_init.sql`) rejects `UPDATE`/`DELETE` on `audit_events` at the
DB level as a second line of defence beyond just "the ORM never issues them."

## Endpoints (read-only)

```
GET    /audit/patient/{patient_id}       → full audit trail for a patient
GET    /audit/user/{user_id}             → everything a given user did
GET    /audit/events?limit=&offset=      → paginated global log (admin only)
GET    /audit/report/{start}_{end}       → GDPR report for a date range, e.g. /audit/report/2026-01-01_2026-12-31
GET    /health
GET    /metrics                          → Prometheus
```

RBAC (`shared/rbac.json`): `AUDIT_READ` (ADMIN, DATA_PROTECTION_OFFICER),
`GDPR_REPORT` (DATA_PROTECTION_OFFICER only).

## Consumer (`app/services/consumer.py`)

Runs as a background asyncio task started in `main.py`'s FastAPI lifespan
(not a separate process). Uses `XREADGROUP` against consumer group
`audit-consumers` across five streams:

- `audit.event.logged` — recorded verbatim (already fully formed by the producer)
- `patient.record.updated`, `lab.result.filed`, `lab.result.critical`,
  `lab.result.acknowledged` — auto-logged with a derived `action`/`resource_type`
  even if the producing service forgot to also emit an explicit
  `audit.event.logged` (belt-and-braces, per architecture doc §5)

Failed entries are pushed to `stream:<name>.dlq` and acked anyway (an audit
entry that can never be parsed shouldn't block the stream forever) — same DLQ
convention as `shared/EVENTS.md` describes for other consumers.

Note: this means a lab result filing produces **two** audit rows today — one
explicit (from lab-service's own `_log_audit` call) and one auto-logged (from
consuming `lab.result.filed`). That duplication is what the original
architecture doc specifies; not fixed here since it's a "which service is
source of truth" decision, not a bug.

## Run standalone

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
JWT_PUBLIC_KEY_PATH=../../shared/keys/jwt_public.pem \
  .venv/bin/uvicorn app.main:app --reload --port 8004
```

## Test

```bash
.venv/bin/python -m pytest
```
