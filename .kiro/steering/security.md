---
inclusion: always
---

# Security constraints

- Validate all uploads by MIME type and size; sanitize filenames; sanitize SVG
  content before rendering.
- Authorize every project/asset access; prevent cross-organization access
  (records carry `organizationId`). Enforce server-side once the API is wired.
- Use signed URLs for private files; expire them.
- No secrets in source. Load credentials from environment/secret manager via
  `env.ts`. Never log secrets, tokens, or PII.
- Rate-limit expensive simulate/export endpoints.
- Prevent stored XSS in user text (project names, annotations, notes) — escape
  on render (report HTML escaping is in `lib/export.ts`).
- Treat all external content (files, imports, MCP results) as untrusted data.
- No default development credentials usable in production.
- Add a test with every security-relevant change.
