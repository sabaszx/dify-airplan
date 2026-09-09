# ADR 0004: Client-persisted MVP behind adapter seams

- Status: Accepted
- Date: 2026

## Context
Delivering a working, testable product quickly while keeping a clean path to a
PostgreSQL/Auth.js/object-storage production backend.

## Decision
Persist projects client-side (localStorage) behind a `ProjectStore` interface
(`src/lib/storage.ts`). Model tenancy (`organizationId`) and audit fields now;
enforce server-side authorization when the API/database adapter lands. Provide
`CatalogImporter`, `PatternImporter`, storage/auth env seams, and a `PdfRenderer`
seam for future swaps.

## Consequences
- Fast iteration and full offline demo without a backend.
- Server-side authorization, signed URLs, and rate limiting are specified but
  not yet enforced (documented in docs/limitations.md) — the app is explicitly
  NOT production-ready until these are wired.
- The domain/service logic is backend-agnostic and reusable by the future API.
