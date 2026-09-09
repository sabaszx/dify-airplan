---
inclusion: auto
name: observability
description: Apply when creating or modifying logging, metrics, health checks, jobs, or error handling.
---

# Observability

- Structured logging (JSON) with a correlation/trace id per request; never log
  secrets or PII.
- Health endpoint `GET /api/health` (liveness) and `GET /api/ready` (readiness:
  checks dependencies when wired).
- Metrics to track: simulation duration, report-generation duration, autosave
  latency, failed background jobs, DB/storage health.
- Central error handling with an error-tracking abstraction (pluggable sink).
- Background jobs (simulation/report) should have retry and failure monitoring;
  keep them idempotent where practical and support graceful shutdown.
