# Threat Model

Lightweight STRIDE-oriented model for the Cisco Wi-Fi Planner.

## Assets

Project designs, floor-plan images, catalog/pattern data, report snapshots,
org/user identity, credentials.

## Trust boundaries

Browser client ↔ Next.js API; API ↔ database/object storage; app ↔ MCP servers
(dev only, untrusted results); user uploads (untrusted).

## Threats & mitigations

- **Spoofing / broken auth** → Auth.js-compatible auth; org-scoped access;
  server-side ownership checks (planned with API). Property test asserts
  org-boundary isolation.
- **Tampering (IDOR)** → never trust client-supplied project/org ids; scope all
  queries by `organizationId`.
- **Repudiation** → audit fields on records; report snapshots record who/when.
- **Information disclosure** → signed, expiring URLs for private files; no
  secrets/PII in logs; least-privilege MCP (docs/mcp-security.md).
- **DoS** → rate-limit simulate/export; upload size limits; simulation in a
  cancellable worker.
- **Elevation** → no default dev credentials in prod; minimal container user.
- **Malicious uploads** → MIME/size validation; SVG sanitization; path-traversal
  safe filenames.
- **Stored XSS** → escape user text in report output; sanitize rendered SVG.
- **Supply chain** → pinned versions; CI dependency audit.
- **Prompt injection via MCP/fetched content** → treat as data, not instructions.

## Residual risk / gaps

Server-side authz, signed URLs, and rate limiting are specified but not yet
enforced in the client-persisted MVP. Full pen-testing is out of scope here.
