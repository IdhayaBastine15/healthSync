# HealthSync

Real-time healthcare data integration platform — a microservices reference
architecture demonstrating event-driven patient record and lab result
synchronisation across clinical systems. Full design rationale is in
[`HealthSync_Architecture_Complete.md`](./HealthSync_Architecture_Complete.md).

The original doc describes Kafka + one Postgres instance per service. What's
actually implemented uses **Redis Streams** (as a Kafka stand-in — see
[`shared/EVENTS.md`](./shared/EVENTS.md) for why) and a **single Postgres
instance with one schema per service** (see the header comment in
[`shared/sql/001_init.sql`](./shared/sql/001_init.sql)) — both free-tier-friendly
substitutes for the same architecture, no application code differs as a result.

## Services

| Service | Language | Port | Status | README |
|---|---|---|---|---|
| patient-service | Python/FastAPI | 8001 | built, tested, runs, deployed | [services/patient-service/README.md](services/patient-service/README.md) |
| lab-service | Python/FastAPI | 8002 | built, tested, runs, deployed | [services/lab-service/README.md](services/lab-service/README.md) |
| audit-service | Python/FastAPI | 8004 | built, tested, runs, deployed | [services/audit-service/README.md](services/audit-service/README.md) |
| analytics-service | Python/FastAPI | 8005 | built, tested, runs, deployed | [services/analytics-service/README.md](services/analytics-service/README.md) |
| notification-service | Node/Express/Socket.io | 8003 | built, tested, runs, deployed | [services/notification-service/README.md](services/notification-service/README.md) |
| api-gateway | Node/Express | 8000 | built, tested, runs, deployed | [services/api-gateway/README.md](services/api-gateway/README.md) |
| frontend | React/Vite | 3000 | built, deployed | [frontend/README.md](frontend/README.md) |

Live (Render free tier — cold-starts after 15min idle): frontend at
`healthsync-frontend-khoe.onrender.com`, api-gateway at
`healthsync-api-gateway.onrender.com`; see `render.yaml` for the rest.

## Running locally

```bash
docker compose up -d --build
```

Brings up Postgres (host port **5434**, remapped from 5432 — see
`docker-compose.yml` comment), Redis, and every service with a Dockerfile.
Postgres auto-runs `shared/sql/001_init.sql` on first boot to create schemas
and tables.

### Getting a login


**1. Sign up.** `POST /auth/register` (patient-service, proxied at
`/api/v1/auth/register`) is a working self-signup endpoint — the frontend's
`/signup` page uses it. No admin-approval step exists, so it lets the
signer pick any role in `shared/rbac.json`'s list (NURSE, DOCTOR,
CONSULTANT, LAB_TECH, ADMIN, DATA_PROTECTION_OFFICER) — a deliberate
demo-only trade-off (a real hospital provisions staff accounts via an
admin, not self-service), documented in `services/patient-service/README.md`.


## Repo layout

- `services/` — one directory per microservice, each independently
  buildable/testable/deployable (own `requirements.txt`/`package.json`,
  `Dockerfile`, `tests/`).
- `shared/` — cross-service contracts only: the RBAC permission table
  (`rbac.json`), the JWT keypair (`keys/`, gitignored — regenerate, don't
  commit), the Postgres schema (`sql/001_init.sql`), and the event contract
  (`EVENTS.md`).
- `frontend/` — React SPA (not yet built out beyond a directory skeleton).
- `docker-compose.yml` — local dev stack for whichever services currently
  have a Dockerfile.
