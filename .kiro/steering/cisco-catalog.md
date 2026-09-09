---
inclusion: auto
name: cisco-catalog
description: Apply when creating or modifying AP models, SKUs, radios, antennas, catalog data, or datasheet provenance.
---

# Cisco catalog guidance

- Specifications are DATA, not hardcoded UI logic: `src/catalog/cisco-aps.json`
  validated by `src/catalog/schema.ts`.
- Every seeded value is `verified: false` (sample). Do not invent authoritative
  Cisco specifications. Cite official manufacturer sources for verified data via
  `PatternProvenance` (document title, URL, revision, page/figure, gain type,
  retrieved date, verification status).
- Preserve immutable `productRevisionId`; APs store a `catalogSnapshot` so future
  catalog updates never silently change existing project simulations.
- No Cisco logos or copyrighted datasheet content; text labels and neutral
  placeholders only. Show "Verify with official Cisco documentation" in reports.
- Verification states: draft / sample / extracted-from-datasheet /
  manually-reviewed / manufacturer-verified / deprecated.
