# Admin Guide

## Catalog management
AP specifications are data (`src/catalog/cisco-aps.json`, validated by
`src/catalog/schema.ts`). To add or update a model:
1. Add/edit the product record (fields in docs/cisco-catalog.md).
2. Keep `verified: false` until confirmed against official Cisco documentation.
3. Assign a stable `productRevisionId`; never mutate a published revision —
   create a new one so existing projects stay reproducible.
4. Cite sources via provenance when marking data verified.

## Antenna patterns
Import via the Pattern Import panel (Settings): native JSON, CSV cuts, combined
CSV, or MSI. Review validation errors/warnings and the polar preview before
saving. Fallbacks are always flagged. See docs/antenna-pattern-format.md.

## Regulatory domains
Channel/power rules are data (`src/regulatory/domains.ts`). These are planning
defaults; verify current local regulations (especially 6 GHz and power modes).
Enable/disable DFS per project.

## Environments & secrets
Configure via environment variables (docs/deployment.md, `.env.example`),
validated by `src/lib/env.ts`. No secrets in the repo. No default dev
credentials usable in production.

## MCP
Optional, read-only, disabled by default; see docs/mcp-security.md. The app does
not depend on MCP at runtime.
