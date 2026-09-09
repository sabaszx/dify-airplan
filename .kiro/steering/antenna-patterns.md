---
inclusion: auto
name: antenna-patterns
description: Apply when creating or modifying antenna-pattern import, validation, transformation, interpolation, selection, or provenance.
---

# Antenna pattern guidance

- Schema and JSON Schema mirror live in `src/antenna/schema.ts` (Zod). Patterns
  carry a verification status and provenance.
- Import pipeline (`src/antenna/import.ts`) supports JSON/CSV/combined-CSV/MSI and
  a `PatternImporter` adapter. Validate before save; return errors + warnings; do
  not save invalid patterns unless explicitly kept as a draft.
- A 2D polar-plot image is NOT structured data; store the reference and require
  manual digitization, flagged "extracted-from-datasheet" and requiring review.
- Gain (`src/antenna/gain.ts`): circular interpolation across 0/360; documented
  2-cut combination `G ≈ peak + (Ga−peak) + (Ge−peak)`; a directional antenna is
  NEVER silently treated as omnidirectional.
- Selection (`src/antenna/select.ts`): strict hierarchy exact-sku → exact-model →
  family → manufacturer-spec → labeled generic fallback. Always flag fallback.
- Preserve original imported samples; automatic transforms create a derived
  revision. Include pattern revision in simulation cache keys.
