# analytics-service

Python 3.11 · FastAPI · SQLAlchemy (async) · PostgreSQL (`analytics` schema) · Redis

Doc §6 also lists Pandas — dropped here since every metric below is a
straightforward SQL aggregate (`COUNT`/`AVG`/`GROUP BY`); pulling rows into
a DataFrame to do that would be strictly slower and add a dependency for no
benefit.

Passive consumer, same shape as `audit-service`: it doesn't receive writes
via its own API, it ingests `lab.result.filed`/`lab.result.critical`/
`lab.result.acknowledged`/`patient.record.updated` events off Redis Streams
and persists derived metrics, which the read-only endpoints below then
aggregate.

## Endpoints (read-only)

```
GET    /analytics/dashboard                     → operational summary (TAT, pending acks, critical count)
GET    /analytics/lab-turnaround/{start}_{end}  → lab TAT metrics for a date range, e.g. /analytics/lab-turnaround/2026-01-01_2026-12-31
GET    /analytics/critical-alerts/{start}_{end} → critical alert response times for a date range
GET    /analytics/patient-volume?days=30        → record-update volume per day (see note below)
GET    /analytics/system-health                 → analytics-consumers lag per stream (Kafka-lag equivalent)
GET    /health
GET    /metrics                                 → Prometheus
```

RBAC (`shared/rbac.json`): `ANALYTICS_READ` (ADMIN, CONSULTANT).

Doc §6 asks `/analytics/patient-volume` for "admissions/discharges over
time" and `/analytics/system-health` for "all services health + Kafka lag."
Neither admission/discharge events nor cross-service HTTP health checks
exist anywhere else in this system (only `patient.record.updated`, and no
service currently polls its siblings over HTTP) — see the docstrings in
`app/routers/analytics.py` for what these endpoints report instead and why.

## Consumer (`app/services/consumer.py`)

Runs as a background asyncio task started in `main.py`'s FastAPI lifespan,
same pattern as `audit-service`. Uses `XREADGROUP` against consumer group
`analytics-consumers` across four streams, writing into the `analytics`
schema's two tables (`shared/sql/001_init.sql`):

- `lab.result.filed` → inserts an `analytics.lab_turnaround` row
- `lab.result.critical` → flags `is_critical`, inserting the row too if
  `lab.result.filed` hasn't been delivered yet (order across two streams
  isn't guaranteed)
- `lab.result.acknowledged` → sets `acknowledged_at` and computes
  `time_to_acknowledge_seconds` on the matching row
- `patient.record.updated` → inserts an `analytics.record_access_log` row

Failed entries go to `stream:<name>.dlq` and are acked anyway, same DLQ
convention as `shared/EVENTS.md` / `audit-service` use.

## Run standalone

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
JWT_PUBLIC_KEY_PATH=../../shared/keys/jwt_public.pem \
  .venv/bin/uvicorn app.main:app --reload --port 8005
```

## Test

```bash
.venv/bin/python -m pytest
```
