---
inclusion: auto
name: wall-geometry
description: Apply when creating or modifying wall thickness, thick-wall geometry, wall rendering, resizing, joins, or wall RF intersection.
---

# Wall geometry & thickness

- A wall has a PHYSICAL thickness (meters), separate from visual line width, RF
  attenuation, height, bottom elevation, and material. A thick wall does not
  automatically lose more than a thin wall of another material.
- Store thickness in meters; accept unit-aware input (mm/cm/m/in/ft) via
  `src/lib/thickness.ts`. Presets are planning defaults, not universal standards.
- Zoom changes visual width only; it must NEVER change stored thickness.
- Thick-wall geometry lives in `src/geometry/thick-wall.ts`: `segmentRect`
  (center/left/right alignment), `inMaterialLength` (ray chord — perpendicular =
  thickness, oblique longer), `polylineInMaterialLength`.
- RF (`src/rf/attenuation.ts` + engine `wallLossForKey`): fixed-loss materials
  are counted ONCE per physical crossing (thickness ignored); thickness-dependent
  materials use the in-material path length. Never infer attenuation from visual
  thickness. Document the oblique-path approximation.
- Resizing must preserve openings, shared vertices, and connected corners; a
  resize creating invalid geometry must warn and be undoable (one command).
- Add deterministic tests for any thickness/geometry change.
