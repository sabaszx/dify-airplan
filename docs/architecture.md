# Architecture

Layered so the domain and RF engine are framework-independent and testable
without a browser. Full rules in `.kiro/steering/architecture.md`.

## Layers
1. UI/editor — React (`src/components`, `src/app`)
2. Canvas geometry — `src/geometry`, `src/editor`
3. Domain model — `src/domain`
4. RF engine — `src/rf` (deterministic, no DOM)
5. Channel optimizer — `src/rf/channel.ts`
6. Capacity estimator — `src/rf/capacity.ts`
7. Catalog + antenna patterns — `src/catalog`, `src/antenna`
8. Persistence/API — `src/lib/storage.ts` adapter, `src/app/api`
9. Export/report — `src/lib/export.ts`, `src/lib/report-snapshot.ts`

## Runtime
- Next.js App Router; RF simulation runs in a Web Worker (`src/workers`).
- Health `/api/health`, readiness `/api/ready`.
- Persistence via a `ProjectStore` adapter (MVP: `localStorage`; production:
  PostgreSQL/Prisma implementing the same interface).

## Key invariants
- SI units internally; meter coordinates for objects.
- Immutable catalog/pattern revisions; APs carry a `catalogSnapshot`.
- Every canvas mutation is an undoable Command (drag coalesces to one entry).
- No MCP dependency at runtime.

## Diagram (textual)
```
UI/app ──▶ editor/geometry ──▶ domain ──▶ rf engine ──▶ heatmap/analysis
   │                                   ├─▶ channel/capacity
   ├─▶ catalog + antenna patterns ─────┘
   └─▶ persistence adapter / export + report snapshot
```
