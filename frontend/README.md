# frontend

React 18 · TypeScript · Vite 6 · Tailwind 4 · Zustand · React Router · Socket.io-client

## Pages / routes

```
/login                → LoginPage
/signup                → SignupPage (self-signup, any role - see patient-service/README.md)
/dashboard             → DashboardPage (default route)
/patients               → PatientSearchPage        (PATIENT_READ)
/patients/:id           → PatientDetailPage         (PATIENT_READ)
/results/file            → FileLabResultPage         (RESULT_FILE)
/results/:id            → LabResultDetailPage        (RESULT_READ)
/audit                  → AuditLogPage               (AUDIT_READ)
```

Route guarding is via `<ProtectedRoute requiredPermission="...">`
(`src/components/Auth/ProtectedRoute.tsx`), checking the same
`shared/rbac.json` permission names as every backend service — see
`src/utils/rbac.ts`. There's no `/analytics` route yet — analytics-service
is wired end-to-end through the gateway but this frontend has no dashboard
page consuming it.

## Two backend connections

- **REST**, via `src/services/api.ts` → `api-gateway` (`VITE_API_GATEWAY_URL`,
  empty locally so it falls through to the Vite dev-server proxy in
  `vite.config.ts` → `http://localhost:8000`). Handles the access-token
  refresh-on-401 flow (single in-flight refresh shared across concurrent
  failing requests, see `refreshPromise` in `api.ts`).
- **WebSocket**, via `src/services/socket.ts` → `notification-service`
  directly (`VITE_NOTIFICATION_SERVICE_URL`, default
  `http://localhost:8003`), **not** proxied through api-gateway — see the
  comment at the top of `socket.ts`.

State: `src/store/authStore.ts` (tokens, persisted), `src/store/notificationStore.ts`
(live critical-alert banner state, in-memory only — a reload loses it,
consistent with notification-service itself keeping no history).

## Run standalone

```bash
npm install
npm run dev   # .env.development already points at localhost:8000/8003
```

Needs `api-gateway` (and `notification-service` for live alerts) running
locally — see the repo root README's `docker compose up -d --build`.

## Test

No automated test suite — `npm run build` (`tsc -b && vite build`) is the
only CI-equivalent check today; it typechecks the whole app before bundling.

```bash
npm run build
```
