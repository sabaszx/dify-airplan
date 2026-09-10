# Operations

## Endpoints

- Liveness: `GET /api/health` (200 when up).
- Readiness: `GET /api/ready` (200 ready / 503 not-ready; lists dependency status).

## Logging & tracing

Emit structured (JSON) logs with a correlation id per request. Never log secrets
or PII. Route errors through a central handler with a pluggable error-tracking
sink (`ERROR_TRACKING_DSN`).

## Metrics to monitor

Simulation duration, report-generation duration, autosave latency, failed
background jobs, database health, storage health.

## Background jobs

Simulation and report generation should run as jobs with retry and failure
monitoring; keep them idempotent and support graceful shutdown.

## Incident response (outline)

1. Confirm scope via `/api/health` and `/api/ready`.
2. Check recent deploys; roll back to the last known-good image if needed.
3. Inspect structured logs by correlation id; check error-tracking sink.
4. If data-related, follow docs/backup-restore.md.
5. Record a post-incident note and, if warranted, an ADR.

## Status / gaps

Structured logging, metrics, and the error-tracking abstraction are specified
here and in steering; wiring concrete sinks is pending the API/runtime buildout.
