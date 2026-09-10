# Tasks — Cisco Wi-Fi Planner (MVP)

Tasks are small and verifiable. A task is marked `[x]` only after its acceptance
check passes (unit test, type-check, or manual verification noted inline).

## Phase 1 — Foundation

- [x] 1.1 Scaffold Next.js (App Router) + TypeScript strict + Tailwind + tooling
- [x] 1.2 Env-variable validation and config
- [x] 1.3 Domain types + Zod schemas for all entities
- [x] 1.4 Cisco AP catalog data (JSON) + Zod schema + loader, flagged unverified
- [x] 1.5 Project dashboard (create/rename/duplicate/archive/delete, JSON export/import)
- [x] 1.6 Autosave + save-status + localStorage persistence adapter

## Phase 2 — Workspace

- [x] 2.1 Units library (m/ft, dBm) + scale calibration math (unit-tested)
- [x] 2.2 Floor-plan upload (PNG/JPEG/SVG) with MIME/size validation
- [x] 2.3 Canvas: zoom/pan/fit/reset/grid, background lock + opacity
- [x] 2.4 Scale calibration tool
- [x] 2.5 Wall drawing with snapping + material assignment
- [x] 2.6 AP placement, move/rotate/duplicate/delete, properties panel
- [x] 2.7 Undo/redo command history + keyboard shortcuts

## Phase 3 — RF engine

- [x] 3.1 Geometry (segment intersection) + tests
- [x] 3.2 Path-loss (FSPL/log-distance, frequency-aware) + tests
- [x] 3.3 Antenna gain/direction + tests
- [x] 3.4 Engine per-grid-point RSSI/SNR/interference + determinism test
- [x] 3.5 PHY-rate/throughput/capacity lookups
- [x] 3.6 Web Worker + resolution modes + progress/cancel
- [x] 3.7 Heatmap rendering (RSSI/SNR/coverage/…), legend, controls
- [x] 3.8 Point inspector

## Phase 4 — Planning

- [x] 4.1 Regulatory domain data (allowed channels/DFS/power notes)
- [x] 4.2 Channel planner + reasons + override + tests (no unsupported channels)
- [x] 4.3 Capacity zones + estimator + issue list

## Phase 5 — Delivery

- [x] 5.1 Scenario comparison (AP count/coverage/BOM)
- [x] 5.2 Exports: CSV (inventory/BOM), JSON (project/placement), PDF report
- [x] 5.3 Accessibility + EN/TH localization structure
- [x] 5.4 README (setup/architecture/formulas/limitations/deployment)

## Verification status

- Unit tests: RF engine (path loss, wall, antenna, determinism), scale math,
  channel allow-list, capacity — run with `npm test`.
- Type-check: `npm run typecheck`. Lint: `npm run lint`.
- Manual E2E of the DoD workflows via the running dev server.

> Note: This MVP is delivered as a client-side-persisted single-tenant build with
> adapters ready for PostgreSQL/Prisma/Auth.js. See README "Limitations".

---

## Override slice: thickness / materials / hierarchy / visibility / 3D / resilience

- [x] Fix client-side exception (Suspense for useSearchParams; error boundaries;
      validated/migrated project load). Regression tests: `report-route.test.ts`,
      `load-project.test.ts`, `migrate.test.ts`.
- [x] Editable wall thickness UI (numeric/slider/increment/presets/bulk/alignment),
      meters storage, undoable. Tests: `wall-thickness.test.ts`.
- [x] Custom material library CRUD + dB attenuation + validation + versioning +
      JSON import/export. Tests: `material-library.test.ts`.
- [x] Floor hierarchy (Building/Floor explicit, explicit ordering, add/dup/
      archive/delete, report-reference safety). Tests: `hierarchy.test.ts`.
- [x] Independent Wi-Fi/BLE/UWB visibility (4 states, persisted, symbols, 2D+3D).
      Tests: `layer-visibility.test.ts`.
- [x] 3D view derived from 2D data (dynamic import, extrude by thickness+height,
      floors at elevations, WebGL fallback + error boundary). Tests: `scene.test.ts`.
- [x] Backward-compatible migrations (`migrate.ts`). Tests: `migrate.test.ts`.

Verification commands run: `tsc --noEmit`, `next lint`, `vitest run`, `next build`,
`playwright test`. Results reported in the delivery summary (honest pass/partial).
