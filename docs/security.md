# Security

See `.kiro/steering/security.md` for the enforced rules. This documents the
posture and controls.

## Controls implemented

- Upload validation: MIME type + size checks (`handleUpload`); filename
  sanitized. SVG sanitization must run before rendering untrusted SVG.
- Report HTML output escapes user text (`esc` in `src/lib/export.ts`) to prevent
  stored XSS from project names/annotations/notes.
- Security headers + CSP in `next.config.mjs` (X-Content-Type-Options,
  X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS).
- Env validation via `src/lib/env.ts` (Zod). No secrets in source.
- Tenancy: every project carries `organizationId`; access policy is
  org-scoped (property-tested). Server-side enforcement lands with the API.

## Controls planned / partial (documented gaps)

- Server-side authorization + signed URLs + rate limiting are specified in
  steering and `.env.example` but not yet enforced (MVP persists client-side).
- CSRF protection applies once authenticated mutating endpoints exist.
- Dependency audit runs in CI (`npm audit --audit-level=high`).

## Data handling

Treat all external content (uploads, imports, MCP results) as untrusted.
Never log secrets, tokens, or PII. No default dev credentials usable in prod.
