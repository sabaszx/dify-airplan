# API

Route handlers live under `src/app/api/`. Conventions in
`.kiro/steering/api-standards.md`.

## Implemented

- `GET /api/health` — liveness. `200 { status: "ok", uptimeSeconds, timestamp }`.
- `GET /api/ready` — readiness. `200 { status: "ready", checks[] }` or `503`
  when a required dependency is unconfigured.

## Planned (specified, not yet built)

CRUD for organizations/projects/scenarios/floors/APs/walls; floor-plan upload
with signed URLs; catalog + antenna-pattern import; simulation jobs; report
generation and snapshot retrieval. All must:

- Validate inputs with Zod and return `{ error: { code, message } }` on failure.
- Authorize every request and scope queries by `organizationId`.
- Rate-limit expensive endpoints (simulate/export).
- Carry a correlation id in structured logs; never log secrets/PII.

An OpenAPI contract should be added once the mutating endpoints exist; the pure
domain/service layer already contains the business logic these handlers will
orchestrate.
