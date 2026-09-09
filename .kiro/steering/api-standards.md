---
inclusion: auto
name: api-standards
description: Apply when creating or modifying API route handlers, services, or the service layer.
---

# API standards

- REST route handlers under `src/app/api/`. Validate inputs with Zod; return
  typed JSON with consistent error envelopes `{ error: { code, message } }`.
- Authorize every request; scope all queries by `organizationId`. Never trust a
  client-supplied org/project id without an ownership check.
- Rate-limit expensive endpoints (simulate, export).
- Health at `GET /api/health`, readiness at `GET /api/ready`.
- Keep business logic in the pure domain/service layers; handlers orchestrate.
- Document endpoints in `docs/api.md`; keep an OpenAPI contract when the API grows.
- Never log secrets or PII; include a correlation id in structured logs.
