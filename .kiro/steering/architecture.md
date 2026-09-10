---
inclusion: always
---

# Architecture

Layered so the domain and RF engine are framework-independent and testable
without a browser.

1. UI/editor (React `components/`, `app/`)
2. Canvas geometry (`geometry/`, `editor/`)
3. Domain model (`domain/`)
4. RF calculation engine (`rf/`)
5. Channel optimizer (`rf/channel.ts`)
6. Capacity estimator (`rf/capacity.ts`)
7. Product catalog (`catalog/`) + antenna patterns (`antenna/`)
8. Persistence/API (`lib/storage.ts` adapter, `app/api/`)
9. Export/report generation (`lib/export.ts`, report snapshot)

## Adapters / seams

`ProjectStore` (persistence), `CatalogImporter` (verified data), `PatternImporter`
(vendor pattern formats), storage/auth via `env.ts`. Future Cisco Catalyst
Center / Meraki integrations MUST be read-only by default.

## Key rules

- Immutable product and antenna-pattern revisions; APs carry a `catalogSnapshot`
  so future catalog changes never silently alter existing simulations.
- Every canvas mutation is a Command (execute/undo/redo, drag coalesced to one).
- Simulation runs in a Web Worker; results cache-keyed by floor/band/scenario/
  resolution/walls/APs/pattern revision.
- The core app must not depend on any MCP server at runtime.
