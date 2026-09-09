# Design — Cisco Wi-Fi Planner (MVP)

This document describes the architecture, data model, and — most importantly —
every RF equation, unit, default, and assumption used by the prediction engine.

## 1. Architecture Layers

The codebase separates concerns so the RF engine is framework-independent and
browser-free (testable under Node/Vitest).

```
src/
  domain/        # Types + Zod schemas for all entities (no framework)
  rf/            # RF calculation engine (pure TS, no DOM) + tests
    geometry.ts  # vector math, segment intersection
    pathloss.ts  # FSPL / log-distance, frequency terms
    antenna.ts   # gain patterns, directional beam
    engine.ts    # per-grid-point simulation orchestration
    channel.ts   # channel optimizer
    capacity.ts  # capacity estimator
    phyrate.ts   # PHY/throughput lookup tables
  catalog/       # Cisco AP catalog data (JSON) + loader + Zod schema
  regulatory/    # regulatory-domain channel/power rules (data)
  store/         # Zustand editor store (autosave, undo/redo)
  workers/       # Web Worker wrapper around rf/engine
  components/    # React UI (canvas, panels, toolbars)
  app/           # Next.js App Router pages + route handlers (API)
  lib/           # units, export (csv/json/pdf), storage/auth adapters
```

Adapters/interfaces: `StorageAdapter`, `AuthAdapter`, `PdfRenderer`,
`CatalogImporter` — allowing future Cisco Catalyst Center / Meraki **read-only**
integrations. No live controller writes in the MVP.

## 2. Units & Coordinates

- Internal storage: **SI**. Distances in **meters**, power in **dBm**,
  frequency in **GHz** (converted to MHz/Hz where formulas need it), gain in **dBi**.
- All object coordinates stored in **real-world meters**; screen pixels are a
  render-time transform via `metersPerPixel` from scale calibration.
- Display conversion (m↔ft) happens only in the UI layer.

### 2.1 Scale calibration

Given a calibration line of pixel length `Lpx` that the user declares is
`Lreal` meters (or feet converted to meters):

```
metersPerPixel = Lreal / Lpx
```

A canvas point `(px, py)` maps to world meters `(px * mpp, py * mpp)`.

## 3. RF Prediction Model (documented)

The model is an **explainable MVP**, modular so a stronger propagation model can
replace `pathloss.ts`/`engine.ts` later. It is **deterministic**.

### 3.1 Free-Space Path Loss (baseline, reference)

FSPL in dB, with distance `d` in meters and frequency `f` in MHz:

```
FSPL(dB) = 20*log10(d) + 20*log10(f) + 32.44
```

(32.44 is the constant for d in km & f in MHz shifted to meters; equivalently
using d in m and f in MHz the constant is 20*log10(4π/c) adjusted → we use the
km form internally by converting d→km. Implementation uses d in meters:
`FSPL = 20*log10(d_m) + 20*log10(f_MHz) - 27.55`, which is the standard meters/MHz
form. Both are documented in code.)

### 3.2 Log-distance path loss (used by engine)

To model indoor environments we generalize FSPL with a path-loss exponent `n`:

```
PL(d) = PL(d0) + 10*n*log10(d/d0)      for d >= d0
```

- `d0` = 1 m reference distance.
- `PL(d0)` = FSPL evaluated at 1 m for the given frequency (frequency-aware).
- `n` = path-loss exponent, configurable by environment:
  - open/free-space: 2.0
  - office (default): 3.0
  - dense/warehouse: 3.5
- For `d < d0` we clamp to `PL(d0)` to avoid singularities.

### 3.3 Frequency awareness

`PL(d0)` grows with frequency, so 5 GHz and 6 GHz have higher intrinsic loss than
2.4 GHz for the same distance — matching physical expectation. Representative
center frequencies used when a specific channel is not given:
- 2.4 GHz band → 2442 MHz
- 5 GHz band → 5500 MHz
- 6 GHz band → 6425 MHz
When a channel is assigned, its actual center frequency is used.

**Mandatory-test consequence:** with all else equal, increasing frequency
increases `PL(d0)` by `20*log10(f2/f1)` dB, so predicted RSSI decreases.

### 3.4 Wall attenuation

For a straight path from AP to grid point, we intersect the segment with every
wall polyline segment. Each intersected wall contributes its per-band
attenuation (dB), scaled by an incidence/thickness factor:

```
wallLoss = Σ over intersected walls ( attenuation_band * thicknessFactor )
thicknessFactor = clamp(thickness_m / referenceThickness, 0.5, 3)   (reference 0.1 m)
```

`attenuation_band` comes from the material's per-band value (planning defaults,
editable). No angle-of-incidence term in the MVP (documented limitation).

**Mandatory-test consequence:** adding a concrete wall between AP and point
strictly reduces predicted RSSI at that point.

### 3.5 Antenna gain & direction

- Omnidirectional (integrated, most indoor APs): gain applied uniformly = `Gt` dBi.
- Directional: azimuth pattern approximated by a cosine-tapered main lobe with a
  configurable half-power beamwidth `bw` (degrees) and front-to-back ratio `FBR`:

```
Δθ = angular offset from boresight (deg), normalized to [-180,180]
if |Δθ| <= bw/2:   patternGain = Gt - 3*(2*Δθ/bw)^2        (≈ -3 dB at beam edge)
else:              patternGain = Gt - FBR * smoothstep(...) (down to Gt - FBR)
```

Rotating the antenna changes boresight azimuth, shifting the main lobe.

**Mandatory-test consequence:** a point on boresight receives higher gain than a
point behind the AP; rotating 180° swaps them.

### 3.6 Mounting height

A simple vertical-offset correction. Horizontal distance `dh` and height
difference `Δh = |apHeight - clientHeight|` (client default 1.0 m) give the true
slant distance:

```
d = sqrt(dh^2 + Δh^2)
```

Higher mounts increase `d` slightly at short range and reduce grazing wall hits
(future work). MVP uses the slant-distance correction only.

### 3.7 Received signal

```
RSSI(dBm) = Ptx(dBm) + Gt(dBi) + Gr(dBi) - PL(d) - wallLoss
```

- `Ptx` transmit power (per radio, dBm).
- `Gt` AP antenna gain (pattern-adjusted).
- `Gr` client/receiver antenna gain (configurable, default 0 dBi).

### 3.8 Noise, SNR, interference

- Noise floor `N0` configurable, defaults (dBm): 2.4→-95, 5→-92, 6→-92.
- `SNR = RSSI_best - N0`.
- Co-channel interference: sum (in linear mW) of RSSI from other audible APs on
  the **same** channel; converted back to dBm as `I_co`.
- Adjacent-channel interference: same but for APs within one channel-width of the
  serving channel, attenuated by an `adjacentRejection` factor (default 20 dB).
- `SINR = RSSI_best - 10*log10( 10^(N0/10) + 10^(I_co/10) + 10^(I_adj/10) )`.
- Audible AP count = number of APs whose RSSI ≥ audibleThreshold (default -85 dBm).

### 3.9 PHY rate / throughput / capacity

- `phyrate.ts` holds **configurable lookup tables** mapping SINR → MCS → PHY
  rate range, parameterized by channel width and spatial streams (Wi-Fi 6 OFDMA
  baseline). Values are planning estimates.
- Usable throughput = `phyRate * efficiencyFactor` (default 0.5 for MAC/airtime
  overhead, configurable).
- Estimated client capacity per AP = `usableThroughput / requiredThroughputPerClient`
  (bounded by a max-clients setting). Labeled an estimate.

### 3.10 Coverage pass/fail

A grid point passes for a requirement profile when:
`RSSI_best >= minRSSI` AND `SNR >= minSNR` AND (if required) a secondary AP meets
`minSecondaryRSSI`.

## 4. Channel Planner (`channel.ts`)

Greedy conflict-minimizing assignment:
1. Load allowed channels for the band from the regulatory domain (DFS toggle applied).
2. For each AP (ordered by neighbor degree), pick the allowed channel minimizing
   a cost = `coChannelNeighbors*W1 + adjacentOverlap*W2`, where neighbor weight is
   proportional to mutual RSSI.
3. Record a human-readable reason per assignment. Users may override.
Never assigns channels outside the regulatory allow-list (mandatory test).

## 5. Capacity Estimator (`capacity.ts`)

Per zone: `concurrentClients = users * devicesPerUser * concurrency`.
`aggregateDemand = concurrentClients * throughputPerClient`.
`apUtilization = aggregateDemand / (servingAPs * usableThroughputPerAP)`.
Airtime warning when utilization > 0.7; overloaded when > 1.0.
`suggestedAdditionalAPs = ceil(demand / usableThroughputPerAP) - servingAPs`.
All labeled estimates based on declared assumptions.

## 6. Data Model (summary)

Organization → User; Organization → Project → Site → Building → Floor →
FloorPlan; Floor → {AccessPoint→Radio, Wall, CoverageRequirement zones};
Project → {ClientProfile, Scenario, Report}. All records carry audit fields
(createdAt/updatedAt/updatedBy) and belong to an organization for isolation.

## 7. Performance

- Simulation runs in a Web Worker; grid resolution modes: Draft (1.0 m),
  Standard (0.5 m), High (0.25 m).
- Cache key = hash(floorId, band, scenarioId, resolution, wallsHash, apsHash).
- Recompute after a 300 ms debounce; progress + cancel via message channel.

## 8. Security

MIME/size validation, filename + SVG sanitization, per-project authorization,
org isolation, signed URLs for private files, rate limiting on simulate/export,
no secrets in source, no PII/token logging.

## 9. Documented Limitations (MVP)

- 2D single-floor propagation (no inter-floor leakage yet).
- No angle-of-incidence wall term; no reflection/multipath/waveguide effects.
- PHY/throughput/capacity are lookup-based estimates, not measurements.
- Cisco specs are **sample/unverified** until imported from official data sheets.

---

# Design Addendum — Canvas-First UX & Extensibility Override

This addendum supersedes conflicting UI, wall-editing, and antenna requirements
above. It introduces a canvas-first shell, a production wall editor, a
command-based editor architecture, and an extensible antenna-pattern model.

## A. Application Shell (canvas-first)

Five regions: (A) compact global header 44-52px, (B) left navigation rail with
workspaces (Overview, Floor plans, Design, Requirements, Analysis, Inventory,
Reports, Catalog, Settings), (C) central design canvas occupying most of the
viewport, (D) floating contextual bottom toolbar of drawing tools, (E) floating
dockable right inspector that changes with the current selection. The canvas is
the primary experience; chrome stays visually quiet. Original visual identity
via design tokens (colors, type, spacing 8px system, elevation, radius, tool/
selection states, colorblind-safe heatmap palettes, warning levels). Light,
dark, and high-contrast heatmap options. EN/TH-ready.

## B. Command Architecture (`src/store/commands.ts`)

Every canvas mutation is a Command:
```
interface Command {
  label: string;                 // human-readable history label
  affectedIds: string[];         // entity IDs touched
  invalidationBounds?: BBox;     // simulation tiles to invalidate (meters)
  apply(state): void;            // execute / redo
  invert(state): void;           // undo (or store inverse snapshot)
}
```
A CommandStack provides execute/undo/redo with serialization. Continuous pointer
movement (dragging a vertex/AP) is coalesced into ONE undoable command via a
`beginTransient`/`commitTransient` pair, so a drag never floods the history.

## C. Geometry Toolkit (`src/geometry/`) — meters, configurable tolerance `EPS`

- `segmentIntersection(s1,s2)`: proper-crossing point or null.
- `pointOnSegment(p,seg,eps)`: boolean + projection/param `t`.
- `nearestSnap(p, targets, radiusMeters)`: closest snap target with type.
- `splitWallAt(wall, point)`: two walls sharing a vertex, material preserved.
- `joinWalls(a,b,eps)`: merge when they share an endpoint and are compatible.
- `mergeCollinear(polyline, angleEps)`: drop redundant collinear vertices.
- `polygonCrossing(seg, polygon)`: count/ää detect crossings (for zones).
- `constrainAngle(from, to, stepDeg)`: snap a segment to common angles.
All deterministic; each has unit tests.

## D. Antenna-Pattern Model (`src/antenna/`)

A Product has SKUs/variants; a Radio maps to an Antenna; an Antenna has one or
more frequency Patterns with separate azimuth and elevation cuts. Schema fields
per §6.1 of requirements (id, manufacturer, model, type, polarization,
frequency, peakGainDbi, azimuth[], elevation[], beamwidth, FBR, downtilt,
coordinate system, orientation, source, lastVerified, verificationStatus,
patternFormatVersion, notes). Provided as both a JSON Schema and a Zod schema.

Import pipeline (`src/antenna/import.ts`): native JSON, CSV azimuth, CSV
elevation, combined CSV (freq,az,el,gain); MSI Planet `.msi` best-effort; a
documented `PatternImporter` adapter interface for future vendor formats. A 2D
polar-plot image is explicitly NOT accepted as structured data.

Import validation (`validatePattern`): required metadata, valid frequency,
angle ranges, duplicate angles, missing samples, gain units, coordinate system,
0/360 closure, unrealistic gain, radio compatibility, schema version. Returns a
summary of errors + warnings; invalid patterns are not saved unless explicitly
kept as a draft. Automatic transforms (normalize, interpolate, rotate, mirror,
relative→absolute) preserve the original import and create a derived revision.

### D.1 RF-engine use of patterns (`src/antenna/gain.ts`)

1. vector AP→point in world; 2. transform into antenna local frame using AP
rotation, mounting orientation, and downtilt; 3. derive azimuth φ and elevation
θ; 4. select/interpolate the frequency pattern nearest the radio channel; 5.
interpolate az-cut gain `Ga(φ)` and el-cut gain `Ge(θ)` using circular
interpolation across 0/360; 6. combine cuts.

**Documented cut-combination approximation (MVP):** with only separate az/el
cuts, we approximate the 3D gain as
```
G(φ,θ) ≈ peakGainDbi + (Ga(φ) − peakGainDbi) + (Ge(θ) − peakGainDbi)
```
i.e. additive relative-to-peak deltas (a standard, clearly-labeled 2-cut
approximation). Clamped to [peak − 60 dB, peak]. Sparse patterns are handled by
nearest-neighbor fallback with a warning flag. If no validated pattern exists,
a labeled simplified cosine model is used — a directional antenna is NEVER
silently treated as omnidirectional. The pattern revision id is included in the
simulation cache key; changing assignment/orientation recomputes affected tiles.
Interface is shaped so a full 3D spherical gain matrix can replace the 2-cut
model later.

## E. Openings

An Opening attaches to a parent wall (parametric position along the segment)
with type/width/height/elevation/open-closed/material and per-band attenuation.
It moves with its wall. RF MVP models an opening as a replacement segment with
its own attenuation.

## F. Documented deltas & limitations for this addendum

- Full 3D spherical patterns, WebGL heatmap tiling, minimap, rulers, and the
  full 10-step catalog onboarding UI are architected but only partially surfaced
  in the MVP UI; the data models and engine seams are complete and tested.
- Playwright E2E remains a documented gap; deterministic Vitest unit tests cover
  geometry, interpolation, coordinate transforms, commands, and pattern import.
