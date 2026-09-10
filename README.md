# Cisco Wi-Fi Planner (MVP)

A desktop-first web application for designing and evaluating Cisco wireless
access-point deployments on building floor plans: upload a plan, calibrate its
scale, draw walls, place and configure Cisco APs, generate explainable
predictive RF heatmaps, plan channels and capacity, compare scenarios, and
export professional reports.

> **Predictive estimates only.** All RF outputs are planning predictions, not
> site-survey measurements. Validate the final design with an on-site survey and
> applicable regulatory requirements.
>
> **Cisco product data is SAMPLE / UNVERIFIED.** Every catalog value is flagged
> `verified: false`. Verify with official Cisco documentation before use. No
> Cisco logos or proprietary datasheet content are included — model names are
> used only as neutral text labels.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Other commands:

```bash
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # next lint
npm test             # vitest run (RF engine, catalog, store, exports)
```

Optional local PostgreSQL (for the future DB-backed adapter):

```bash
docker compose up -d
cp .env.example .env.local
```

## What you can do (Definition of Done)

1. Create / rename / duplicate / archive / delete projects (dashboard).
2. Upload a PNG/JPEG/SVG floor plan and calibrate its real-world scale.
3. Draw walls and assign attenuation materials (drywall, glass, concrete, …).
4. Place and configure multiple Cisco AP models (radios, power, channels,
   width, antenna direction, mounting height).
5. Generate 2.4 / 5 / 6 GHz RSSI and SNR heatmaps (Web Worker, cancellable).
6. Inspect the calculated result at any point (status bar).
7. View coverage/pass-fail heatmaps and capacity warnings.
8. Auto-plan channels per regulatory domain (US/EU/TH) with reasons + override.
9. Compare scenarios (AP count, floors, BOM) and promote a baseline.
10. Export a PDF design report, AP inventory CSV, BOM CSV, and project/placement JSON.
11. Reload without losing work (autosave to persistence adapter).

## Architecture

Layers are separated so the RF engine is framework-independent and testable
without a browser.

```
src/
  domain/     Types + Zod schemas for all entities (coords in meters, SI units)
  rf/         RF engine (pure TS, no DOM): geometry, pathloss, antenna,
              phyrate, engine, channel planner, capacity estimator
  catalog/    Cisco AP catalog DATA (JSON) + Zod schema + loader
  regulatory/ Configurable regulatory-domain channel/power rules
  store/      Zustand editor store (autosave + undo/redo)
  workers/    Web Worker wrapper around rf/engine (progress + cancel)
  lib/        units, viewport, heatmap colors, exports, storage/i18n adapters
  components/ React UI (canvas, toolbars, panels)
  app/        Next.js App Router pages
```

Adapter interfaces enable future integrations without rewrites: `ProjectStore`
(persistence), `CatalogImporter` (verified Cisco data imports), a `PdfRenderer`
seam (the MVP uses the browser print pipeline), and the storage/auth seams for
PostgreSQL/Prisma/Auth.js. **Any future Cisco Catalyst Center / Meraki
integration must be read-only by default** and require explicit authorization
for writes.

## RF model (summary — full detail in `.kiro/specs/cisco-wifi-planner/design.md`)

Deterministic, explainable, and modular so a stronger propagation model can
replace `rf/pathloss.ts` and `rf/engine.ts` later.

- Free-space path loss: `FSPL = 20·log10(d_m) + 20·log10(f_MHz) − 27.55`
- Log-distance: `PL(d) = PL(d0) + 10·n·log10(d/d0)`, `d0 = 1 m`,
  `PL(d0)` = frequency-aware FSPL at 1 m, exponent `n` by environment
  (open 2.0 / office 3.0 / dense 3.5).
- Received signal: `RSSI = Ptx + Gt + Gr − PL − Σ wallLoss`.
- Wall loss sums per-band material attenuation for every wall the AP→point
  segment crosses, scaled by a thickness factor.
- Directional antennas use a cosine-tapered main lobe (−3 dB at half-beamwidth)
  down to a front-to-back ratio behind the array; rotating changes boresight.
- Mounting height applies a slant-distance correction.
- `SNR = RSSI − noiseFloor`; SINR adds co-channel and adjacent-channel
  interference summed in linear power.
- PHY rate / throughput / client capacity come from **configurable lookup
  tables** (planning estimates), scaled by channel width and spatial streams.

## Limitations (MVP)

- **Persistence is client-side** (`localStorage`) via the `ProjectStore` adapter.
  PostgreSQL/Prisma/Auth.js/object-storage/signed-URLs and multi-tenant
  authorization are stubbed behind interfaces (`src/lib/storage.ts`, `env.ts`),
  not yet wired. Cross-org isolation is modeled in the schema
  (`organizationId`) but enforced server-side only once the API is added.
- **PDF page import** is not rasterized in-browser in this build; upload a
  PNG/JPEG export of the desired PDF page. The upload UI states this clearly
  rather than offering a dead button.
- RF model is **2D single-floor** (no inter-floor leakage), with no
  angle-of-incidence, reflection, or multipath terms.
- Capacity and PHY/throughput values are **estimates** from configurable tables.
- **Playwright E2E is not wired**; critical logic is covered by deterministic
  Vitest unit tests (see below). Adding Playwright is the recommended next step.
- Next.js is pinned at `14.2.15`, which carries a published security advisory.
  Bump to the latest patched `14.2.x` (`npm i next@^14.2`) before any real
  deployment.

## Tests

`npm test` runs 27 deterministic unit tests, including the mandated cases:

- Scale calibration converts canvas distance to meters correctly.
- Increasing frequency increases path loss by `20·log10(f2/f1)` (all else equal).
- Adding a concrete wall reduces predicted signal behind it.
- A directional antenna's gain follows its orientation (rotating swaps the lobe).
- Disabled radio bands never appear in results/heatmaps.
- Unsupported (and DFS-disabled) channels are never assigned by the planner.
- Undo/redo restore AP positions and additions correctly.
- Simulation is deterministic for identical inputs.
- Exported BOM matches the selected scenario; the report shows the correct
  floor and AP count.

## Deployment

1. Set environment variables (see `.env.example`); `env.ts` validates them.
2. `npm run build && npm run start`, or deploy to any Next.js-compatible host.
3. Before production: bump Next.js to a patched version, wire the PostgreSQL
   adapter + Auth.js, move file storage to object storage with signed URLs, and
   add rate limiting to the simulate/export endpoints.

## Spec artifacts

- `.kiro/specs/cisco-wifi-planner/requirements.md` — EARS acceptance criteria
- `.kiro/specs/cisco-wifi-planner/design.md` — architecture + every RF formula
- `.kiro/specs/cisco-wifi-planner/tasks.md` — phased task breakdown

---

## Canvas-First Upgrade (v2)

The app is now a canvas-first design tool with a five-region shell and a
production-grade wall editor and extensible antenna model.

### Shell

- Compact global header (48px), left navigation rail (Overview, Floor plans,
  Design, Requirements, Analysis, Inventory/BOM, Reports, Catalog, Settings),
  central design canvas, a floating bottom tool dock, and a floating, resizable,
  collapsible right inspector that changes with the selection.
- Original design tokens in `src/lib/tokens.ts` (spacing, radius, elevation,
  warning levels with symbol+color, material colors, heatmap-safe palette).

### Continuous wall editor (`src/editor/`)

- Pure, testable drawing state machine: click to add vertices, double-click or
  Enter to finish, Escape to cancel a segment / exit, Backspace to drop the last
  vertex, Shift to constrain angle, Alt to disable snapping, numeric length
  entry, and click-near-start to close a loop. The material stays selected after
  finishing so you can immediately draw another wall.
- Snapping (`src/editor/snapping.ts`) to endpoints, segments, intersections,
  grid, and axes with a zoom-consistent radius and visible snap indicator.
- Live segment length, total length, and angle render on the canvas.

### Geometry toolkit (`src/geometry/`)

Framework-independent, meters, configurable tolerance: `segmentIntersection`,
`pointOnSegment`, `nearestSnap`, `constrainAngle`, `splitPolylineAt`,
`joinPolylines`, `mergeCollinear`, `polygonCrossings` — all unit-tested.

### Command architecture (`src/store/commands.ts`)

Every mutation is a command with a label, affected IDs, and invalidation bounds.
`beginTransient`/`applyTransient`/`commitTransient` coalesce a drag into a single
undoable entry (verified by test).

### Extensible antenna-pattern model (`src/antenna/`)

- Zod schema + a JSON Schema mirror (`schema.ts`) with verification states
  (draft/sample/unverified/verified/deprecated/archived) and preserved original
  import payloads for provenance.
- Import pipeline (`import.ts`): native JSON, CSV azimuth/elevation, combined
  CSV, and best-effort MSI Planet, plus a `PatternImporter` adapter interface.
  `validatePattern` returns actionable errors/warnings; invalid patterns are not
  saved. A polar-plot image is explicitly not accepted as structured data.
- Gain computation (`gain.ts`): circular interpolation across 0/360, a
  documented 2-cut combination `G ≈ peak + (Ga − peak) + (Ge − peak)`, and a
  clearly-labeled cosine fallback. A directional antenna is never silently
  treated as omnidirectional. The RF engine applies AP rotation, mounting, and
  downtilt via `resolveGain` in `src/rf/engine.ts`; pattern revision is part of
  the intended cache key.

### New tests (76 total)

Geometry (17), continuous wall drawing + snapping (11), command stack incl. drag
coalescing (5), antenna import/validation/interpolation/gain (14), and
pattern-driven directional gain in the engine (2), on top of the earlier RF /
catalog / export / store suites.

### Partial / not yet surfaced (documented)

- Full antenna-pattern preview UI (polar plots), the 10-step catalog-onboarding
  wizard, minimap, rulers, and WebGL/tiled heatmap rendering are architected
  (data models + engine seams complete and tested) but only partially exposed in
  the UI. Vertex-drag editing, split/join, and openings exist in the geometry
  layer with tests; the on-canvas editing gestures for vertices/openings are
  partially wired.
- Playwright E2E remains a documented gap; the canvas workflows are covered at
  the logic level by the deterministic unit tests above.

---

## Iteration 3: Wall editing, openings, antenna preview, and E2E

### On-canvas wall editing (`src/editor/wall-editing.ts`)

Pure, tested operations wired into `DesignCanvas` with command transient
coalescing: drag a vertex, drag the whole wall body, double-click a vertex to
remove it, double-click a segment to insert a vertex. Walls gained `heightM`,
`bottomElevationM`, and `openings`.

### Openings

A door/window/archway attaches to a wall at a parametric `(segmentIndex, t)`
position so it stays fixed relative to the wall when the wall moves or resizes
(verified by test). The RF engine models an opening as a replacement sub-segment
with its own (lower) attenuation via `wallPieces` + `WallInput.pieces`.

### Antenna pattern preview & import UI (`src/components/antenna/`)

- `PolarPlot.tsx`: accessible SVG polar plot (azimuth/elevation cuts) with peak
  marker, rotation, and a text summary.
- `PatternImportPanel.tsx`: imports native JSON / combined CSV / azimuth CSV /
  MSI Planet, shows a validation summary (errors + warnings), previews az/el
  polar plots with a rotation slider, and disables save while errors exist.
  Reachable from the Settings workspace; saving assigns the pattern's directional
  characteristics to the selected AP.

### Playwright E2E (`e2e/`)

`npm run test:e2e` (after `npx playwright install chromium`). Specs cover the
DoD-critical flows and pass locally:

- Create a project; project persists across reload.
- Continuous wall drawing (three segments, double-click to finish) without
  reselecting the tool; draw a second wall immediately.
- Place APs continuously; undo/redo restores them.
- Escape cancels the current segment and exits the wall tool.

The suite seeds a calibrated project via `localStorage` (`e2e/helpers.ts`) so
canvas gestures are exercised without a real file upload. Setting up E2E also
surfaced and fixed a real bug: a `useEffect` that returned an assignment
expression (which React treated as a cleanup function) had been breaking the
canvas mount.

### Test totals

88 unit tests (Vitest) + 5 E2E tests (Playwright). `tsc`, `next lint`, and
`next build` all pass.

### Still partial / documented

- The pattern editor (edit individual samples, normalize, interpolate, clone,
  compare) and full per-radio pattern storage in the catalog are modeled but not
  fully surfaced in the UI; the Settings panel applies a pattern's directional
  summary to the selected AP.
- Wall split/join and collinear-merge exist and are tested in the geometry layer;
  the on-canvas split/join gestures are not yet bound.
- Minimap, rulers, and WebGL/tiled heatmap rendering remain future work.

---

## Iteration 4: AP editing, model change, model-specific patterns, context menus

### Post-placement AP editing

Every placed AP is editable via double-click, selection + inspector, right-click
"Edit Access Point", or the AP tabs (Properties / Radios / Pattern). Changes
update the simulation without recreating the AP.

### Model change (`src/domain/model-change.ts`)

`computeModelChange` produces a compatibility summary (preserved / converted /
reset settings, added/removed radios and bands, antenna, regulatory, and
management differences). `applyModelChange` preserves position, name, asset tag,
switch info, mounting, and notes; clamps power/width/spatial-streams to the new
model; drops unsupported bands; and stores a `catalogSnapshot`. The whole
replacement is one undoable command. The `ModelSelector` (search/filter, card and
list views, compare up to 3, datasheet links) and `ModelChangeSummary` modal
drive the flow. Verified by unit and E2E tests (position preserved, band dropped,
undo restores the previous model).

### Model-specific antenna patterns (`src/antenna/select.ts`, `library.ts`)

`selectPattern` resolves a pattern through a strict hierarchy — exact SKU → exact
model → product family (conservative series match) → manufacturer simplified spec
→ explicitly-labeled generic fallback. A fallback is never silent: it always
carries `isFallback` and the warning "No verified model-specific antenna pattern
is available. The simulation is using a simplified fallback pattern." Directional
models resolve directional (sector) patterns, never omni. The AP editor's Pattern
tab shows the resolved pattern, verification status, source datasheet link, and
azimuth/elevation polar plots that rotate with the AP.

### Provenance (`src/catalog/schema.ts`)

`PatternProvenance` records manufacturer, document title/type, source URL,
revision, dates, page/figure/table, gain type (absolute vs relative), importer,
and verification status (draft / sample / extracted-from-datasheet /
manually-reviewed / manufacturer-verified / deprecated). The AP model carries a
`catalogSnapshot` so a future catalog update never silently changes an existing
project's simulation.

### Object-aware context menus (`src/editor/hit-test.ts`, `context-menu.ts`)

Right-click performs hit-testing and opens a menu specific to the topmost object
(AP, wall, wall-vertex, opening, requirement zone, background, empty), selecting
it first. Overlapping objects add "Select Behind" / "Select From List". The menu
is keyboard-accessible (arrows/Enter/Escape), clamps inside the viewport, and
separates destructive actions. `preventDefault` is limited to the canvas, so the
native browser menu still works elsewhere. Shift+F10 and the Context Menu key
open the same menu.

### Data model additions (`src/domain/model.ts`)

`AccessPoint` gained `productRevisionId`, `skuId`, `regulatoryProfileId`,
`orientationAzimuthDegrees`, `orientationDowntiltDegrees`, `antennaAssignments`,
`modelOverrideWarnings`, `catalogSnapshot`, `locked`, and audit timestamps.
`AntennaAssignment` records `radioId`, `antennaId`, `patternRevisionId`,
`orientation`, `mountingMode`, `isFallback`, `fallbackReason`, `overrideReason`.

### Test totals

111 unit tests + 12 Playwright E2E tests. New E2E: double-click opens the editor;
right-click an AP shows AP actions, a wall shows wall actions; Change Model
preserves position and is undoable; Shift+F10 opens the menu; the menu stays in
the viewport; and the native menu still works outside the canvas. `tsc`,
`next lint`, and `next build` all pass.

### Still partial / documented

- Advanced pattern-assignment override with a required reason + audit trail is
  modeled (`overrideReason`, `modelOverrideWarnings`) but the override UI is
  minimal; per-radio/per-antenna/per-mounting pattern storage exists in the model
  and is used by the selector, while the full catalog-onboarding wizard is future
  work.
- Datasheet-image digitization (store image reference + manual angular sampling)
  is specified in the schema (provenance + "extracted-from-datasheet" status) but
  the digitization UI is not yet built.
- Requirement-zone, annotation, and measurement context-menu actions route to
  selection/inspector but some of their editors are not fully implemented.

---

## Iteration 5: Kiro config, quality gates, production scaffolding, docs

### Kiro operating mode

- Steering in `.kiro/steering/`: always-included (product, tech, structure,
  architecture, security, definition-of-done) + auto-inclusion by topic
  (canvas-editor, rf-domain, antenna-patterns, cisco-catalog, reporting, testing,
  api-standards, database-standards, ux-design-system, accessibility,
  observability). Root `AGENTS.md` summarizes the rules.
- Hooks in `.kiro/hooks/`: format+lint on TS save, related unit tests on save,
  pre-task readiness, post-task verification, and an agent-stop quality gate.
  None are destructive or deploy automatically.
- MCP: workspace `.kiro/settings/mcp.json` is permission-protected here, so a
  copy-ready template lives at `docs/mcp/workspace-mcp.example.json` with a full
  policy in `docs/mcp-security.md` (read-only, disabled by default, least
  privilege). The app never depends on MCP at runtime.

### Reproducible reporting

`src/lib/report-snapshot.ts` captures every input needed to reproduce a report
(engine/catalog/project/scenario/pattern revisions, calculation settings, BOM,
product+pattern provenance, a deep scenario copy, transparency flags). Tested for
totals-match-scenario and reproducibility after live-data changes.

### Quality gates (property-based)

`src/**/invariants.property.test.ts` (fast-check, deterministic seeds): distance
& attenuation monotonicity, circular-interpolation continuity, invalid channels
never assigned, omni rotation invariance, serialize roundtrip, undo/redo
equivalence, and organization-boundary isolation.

### Production scaffolding

Health `/api/health` + readiness `/api/ready` routes; CSP + security headers and
`output: standalone` in `next.config.mjs`; multi-stage non-root `Dockerfile` with
a HEALTHCHECK; `.github/workflows/ci.yml` (install→prettier→lint→typecheck→tests
→audit→build, plus e2e and container jobs; production deploy is a manual gate);
expanded `.env.example`.

### Documentation

`docs/`: architecture, domain-model, rf-model, antenna-pattern-format,
cisco-catalog, security, threat-model, mcp-security, testing, reporting,
deployment, operations, backup-restore, release-checklist, api, user-guide,
admin-guide, limitations, and ADRs 0001–0004.

### Verification (this iteration — commands actually executed)

- `npx prettier --check "src/**/*.{ts,tsx}"` → pass (after formatting)
- `npm run lint` → pass (no warnings)
- `npm run typecheck` → pass
- `npm test` → 129 passing (unit + property, 21 files)
- `npm run build` → success
- `npm run test:e2e` → 12 passing (Playwright/chromium)
- Container build → **not executed** (Docker daemon not accessible in this
  environment); Dockerfile + CI `container` job are provided.

### Production-readiness status (honest)

This build is **NOT production-ready**. Client-persisted MVP; server-side
authorization, PostgreSQL/Auth.js, signed URLs, and rate limiting are specified
and modeled but not yet enforced. Integration/API-contract/visual-regression/
automated-accessibility/security-fuzz suites and the full 29-section PDF report
are not yet built. See `docs/limitations.md` and `docs/release-checklist.md`.

# dify-airplan
