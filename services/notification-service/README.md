# notification-service

Node.js 20 · Express · Socket.io · Redis (Streams consumer + JWT blacklist check)

Real-time, in-app delivery of clinical events to connected browser clients.
Doesn't receive writes via its own REST API — like audit-service, it's a
passive consumer that ingests events from other services' Redis Streams and
fans them out over WebSocket.

## Why WebSocket-only (no email/SMS/escalation/history)

The architecture doc (`HealthSync_Architecture_Complete.md`, §Service 4)
specifies three notification channels — WebSocket, email via AWS SES, and
SMS via AWS SNS — plus a Bull-queue-based escalation ladder (an
unacknowledged critical alert auto-escalates to on-call staff after fixed
retry intervals) and notification history/read-state persistence.

This deployment has no AWS account or credentials available, so email/SMS
are out of scope — the same kind of free-tier substitution already made
elsewhere in this repo (see `shared/EVENTS.md`'s "Why not real Kafka"
section for the Redis Streams / Kafka trade-off in the same spirit). What
ships instead:

- **WebSocket only.** Real-time, in-app push while a client is connected.
- **No persistence.** Nothing is written to a database — a client that
  wasn't connected when an event fired simply never sees it. There is no
  `GET /notifications/user/{id}` history endpoint, no read/unread state, no
  `POST /notifications/preferences`.
- **No escalation.** A critical alert is broadcast once; there's no Bull
  queue, no retry/backoff, no auto-escalation to a consultant or ward
  manager if it goes unacknowledged.

Acceptable for a reference/demo app. A real deployment would need at
minimum an email fallback for missed critical alerts, and persistence so a
clinician who reconnects doesn't lose events fired while they were offline.

## Socket.io connection

Clients authenticate at handshake, not per-event:

```js
const socket = io(NOTIFICATION_SERVICE_URL, { auth: { token: accessToken } });
```

The `token` is the same RS256 access token issued by `patient-service`'s
`POST /auth/login`. Verified against `shared/keys/prod_jwt_public.pem`
(same baked-in key every other service uses) plus a `jwt:blacklist:{jti}`
check against Redis (same convention as `security.py` in the Python
services). An invalid/expired/blacklisted token rejects the connection.

Known gap: the token is only checked once, at handshake. A token that
expires or gets blacklisted mid-session does not disconnect an already-open
socket — the client is expected to reconnect with a fresh token on its own
cadence (e.g. next page load), consistent with this service's
no-persistence, best-effort scope.

## Events

### Client → server

```
join-patient-room   { patientId }   → joins room `patient:{patientId}`
leave-patient-room  { patientId }   → leaves that room
```

### Server → client

Each Redis Stream envelope (`{event_id, event_type, schema_version,
timestamp, correlation_id, ...payload}` — see `shared/EVENTS.md`) is
emitted **as-is**, using `event_type` as the Socket.io event name, so the
wire contract is identical whether you're an HTTP/audit consumer or a
browser client.

| Event | Fan-out | Payload adds |
|---|---|---|
| `lab.result.filed` | room `patient:{patient_id}` only | `patient_id`, `result_id`, `is_critical` |
| `lab.result.critical` | **broadcast to every connected client**, plus the room (harmless duplicate) — a clinician not currently viewing this patient still needs the alert | `patient_id`, `result_id`, `severity: "CRITICAL"` |
| `patient.record.updated` | room `patient:{patient_id}` only | `patient_id`, `updated_by` |

## Consumer

Runs as a background loop started in `src/index.js` (not a separate
process) — Node port of `services/audit-service/app/services/consumer.py`'s
pattern. Uses `XREADGROUP` against consumer group `notification-consumers`
across three streams: `lab.result.filed`, `lab.result.critical`,
`patient.record.updated` (not `lab.result.acknowledged` — per
`shared/EVENTS.md`'s own table, that stream's consumers are audit-service
and analytics-service only). Failed entries are pushed to
`stream:<name>.dlq` and acked anyway, same DLQ convention as every other
consumer in this repo.

## Run standalone

```bash
npm install
JWT_PUBLIC_KEY_PATH=../../shared/keys/jwt_public.pem \
  REDIS_URL=redis://localhost:6379 \
  npm start
```

## Test

```bash
npm test
```

## Endpoints

```
GET  /health                    → { status: "ok", service: "notification-service" }
```
