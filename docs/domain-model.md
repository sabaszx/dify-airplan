# Domain Model

Defined with Zod in `src/domain/model.ts` (coordinates in real-world meters).

## Entities
- **Organization / User** — tenancy; every project carries `organizationId`.
- **Project** — customer, location, regulatory domain, units, locale, materials,
  thresholds, scenarios, audit timestamps.
- **Scenario** — a design variant (`isBaseline`), contains floors.
- **Floor** — name, ceiling height, `FloorPlan` (image + `metersPerPixel`),
  walls, access points, requirement zones.
- **Wall** — polyline (meters), materialId, thickness, height, bottom elevation,
  openings.
- **Opening** — door/window/archway attached to a wall at `(segmentIndex, t)`.
- **AccessPoint** — productId + `productRevisionId`, position, rotation,
  orientation azimuth/downtilt, mounting, radios, `antennaAssignments`,
  `modelOverrideWarnings`, `catalogSnapshot`, install metadata, audit fields.
- **Radio** — band, enabled, tx power, channel/width, spatial streams, gain.
- **CoverageRequirement** — zone polygon, users, devices, concurrency, profile,
  thresholds, preferred bands.
- **WallMaterial** — per-band attenuation (planning defaults, editable).

## Revisioning
Product/pattern revisions are immutable; the AP stores a `catalogSnapshot` so a
later catalog change never silently alters an existing project's simulation.
Report snapshots embed a deep copy of the scenario for reproducibility.
