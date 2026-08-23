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

Two ways in:

**1. Sign up.** `POST /auth/register` (patient-service, proxied at
`/api/v1/auth/register`) is a working self-signup endpoint — the frontend's
`/signup` page uses it. No admin-approval step exists, so it lets the
signer pick any role in `shared/rbac.json`'s list (NURSE, DOCTOR,
CONSULTANT, LAB_TECH, ADMIN, DATA_PROTECTION_OFFICER) — a deliberate
demo-only trade-off (a real hospital provisions staff accounts via an
admin, not self-service), documented in `services/patient-service/README.md`.

**2. Demo credentials.** Seed one account per role instead:

```bash
DATABASE_URL=postgresql://healthsync:dev_password@localhost:5434/healthsync \
  services/patient-service/.venv/bin/python scripts/db_bootstrap.py seed-demo
```

| Email | Password | Role |
|---|---|---|
| nurse@healthsync.ie | `DemoPass123!` | NURSE |
| doctor@healthsync.ie | `DemoPass123!` | DOCTOR |
| consultant@healthsync.ie | `DemoPass123!` | CONSULTANT |
| labtech@healthsync.ie | `DemoPass123!` | LAB_TECH |
| admin@healthsync.ie | `DemoPass123!` | ADMIN |
| dpo@healthsync.ie | `DemoPass123!` | DATA_PROTECTION_OFFICER |

Demo-only password, same for every account, committed in plaintext to this
README on purpose — don't reuse it anywhere real. `scripts/db_bootstrap.py`
also still has `seed-user` for a single custom account.

Either way, `POST /auth/login` (or the frontend's `/login` page) returns a
JWT; pass it as `Authorization: Bearer <token>` to any other service — they
all verify against the same RSA keypair in `shared/keys/` and the same
`shared/rbac.json`.

There's no forgot-password flow — this stack has no email service to
deliver a reset link (`services/notification-service/README.md` documents
the same AWS SES/SNS gap for its own notification channels), so it's
intentionally not implemented. Use demo credentials, or re-run `seed-user`/
`seed-demo` to reset a password directly.

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
