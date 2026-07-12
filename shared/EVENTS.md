# HealthSync Event Contract (Redis Streams)

Redis Streams stand in for the Kafka topology described in the architecture
doc (`docs/architecture/system-design.md`, §8). Each "topic" is a Redis
Stream key; consumers use `XREADGROUP` with a consumer group per service,
giving the same at-least-once delivery, ordering-per-key, and replay
semantics Kafka partitions give — on infrastructure that's free to run
(a single Redis instance also used for caching).

| Kafka topic (original doc) | Redis Stream key      | Producer            | Consumers                                  |
|-----------------------------|------------------------|----------------------|---------------------------------------------|
| patient.record.updated      | `stream:patient.record.updated` | patient-service | notification-service, analytics-service, audit-service |
| lab.result.filed            | `stream:lab.result.filed`       | lab-service      | notification-service, audit-service, analytics-service |
| lab.result.critical         | `stream:lab.result.critical`    | lab-service      | notification-service, audit-service |
| lab.result.acknowledged     | `stream:lab.result.acknowledged`| lab-service      | audit-service, analytics-service |
| audit.event.logged          | `stream:audit.event.logged`     | any service (generic audit event) | audit-service |

Consumer groups (mirrors the original Kafka group names):
- `notification-consumers`
- `audit-consumers`
- `analytics-consumers`

## Message envelope

Every stream entry has a single field `data` containing a JSON string:

```json
{
  "event_id": "uuid-v4",
  "event_type": "lab.result.filed",
  "schema_version": "1.0",
  "timestamp": "2026-07-07T10:30:00Z",
  "correlation_id": "request-uuid",
  ...event-specific fields
}
```

## Failed-message handling (Dead Letter Stream)

On processing failure after 3 attempts, consumers `XADD` the raw entry to
`stream:<name>.dlq` instead of acking it, mirroring the DLQ pattern in the
original doc. `XACK` is only called on success or after DLQ hand-off, so a
crashed consumer's pending entries are re-claimed via `XAUTOCLAIM` on
restart — the same "do not commit on failure" guarantee the Kafka consumer
code in the doc relies on.

## Why not real Kafka

Amazon MSK / Confluent Cloud have no permanent free tier. Redis Streams
gives genuinely event-driven, durable, replayable, consumer-grouped
messaging on the same free Redis instance (Upstash) already used for
caching — zero extra infrastructure. See `docs/architecture/adr/ADR-002-kafka-vs-redis-streams.md`.
