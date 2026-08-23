# api-gateway

Node.js 20 · Express · `http-proxy-middleware`

Single entry point for the frontend: authenticates every request once here
(JWT signature + Redis blacklist check), then proxies to whichever backend
service owns the resource. RBAC/permission enforcement is not duplicated
here — that stays server-side in each FastAPI service via `shared/rbac.json`
(single source of truth), same split described in `services/audit-service/README.md`.

## Routes → downstream service

```
POST /api/v1/auth/login, /api/v1/auth/refresh   → patient-service (unauthenticated - no token exists yet)
/api/v1/auth/*                                  → patient-service (authenticated)
/api/v1/patients/*                              → patient-service
/api/v1/results/*, /api/v1/panels/*,
  /api/v1/reference-ranges/*                    → lab-service
/api/v1/audit/*                                 → audit-service
/api/v1/analytics/*                             → analytics-service
```

`services/routes/proxyTargets.js` strips the `/api/v1` prefix using
`req.originalUrl` (not the mutated `req.url` Express hands middleware once
mounted under a sub-path) before forwarding.

## Auth (`src/middleware/auth.js`)

Verifies the RS256 access token against `shared/keys/prod_jwt_public.pem`
and checks `jwt:blacklist:{jti}` in Redis — a Node port of every FastAPI
service's `get_current_user`. A Redis outage doesn't hard-fail the request
(each downstream service performs this same blacklist check itself as the
authoritative gate) — see the comment in `auth.js` for why.

## Rate limiting

In-memory (not Redis-backed — a single free-tier instance has nothing to
share limiter state with), configurable via `RATE_LIMIT_WINDOW_MS` /
`RATE_LIMIT_MAX`. `/health` and `/metrics` are exempt so Render's own
health-check polling can't trip it.

## Endpoints

```
GET  /health               → this instance's own status only (what Render's healthCheckPath uses)
GET  /health/dependencies  → manual-debugging only: pings patient/lab/audit-service in parallel
GET  /metrics               → Prometheus
```

Note: `/health/dependencies` predates analytics-service and notification-service
and was never extended to include them — it's a manual debugging aid, not
load-bearing, so this is cosmetic rather than a functional gap.

## Run standalone

```bash
npm install
cp .env.example .env   # adjust service URLs/JWT path as needed
npm start
```

## Test

```bash
npm test
```
