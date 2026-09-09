---
inclusion: auto
name: reporting
description: Apply when creating or modifying PDF/CSV/JSON reports, BOM, report snapshots, or audit exports.
---

# Reporting guidance

- Reports must be reproducible: capture a report snapshot with all inputs
  (report/project/scenario/catalog/pattern/engine revisions, calculation
  settings, grid resolution, timestamp, generating user, source URLs,
  verification status). See `src/lib/report-snapshot.ts`.
- BOM and totals must match the selected scenario snapshot, not the live catalog.
- Always include the predictive disclaimer and clearly flag: unverified specs,
  generic-fallback patterns, manually digitized patterns, user overrides, missing
  manufacturer info, and regulatory assumptions.
- Escape all user-provided text in generated HTML/report output (XSS).
- Keep export functions pure and unit-tested (`src/lib/export.ts`,
  `src/lib/report-snapshot.ts`).
- PDF quality: legends, page numbers, repeated header/footer, EN/TH fonts, no
  clipped tables. Render and inspect during testing.

## Shareable report + immutability (override §8/§9)
- Reports render ONLY from an immutable `ReportSnapshot` (`src/lib/report-snapshot.ts`),
  never from live project data. Updating the catalog, patterns, prices, or the
  project must not change an existing report; the user generates a new revision.
- The snapshot captures wall thickness + material attenuation models + technology
  configs + per-technology device counts, plus the prior revisions/settings/BOM.
- Read-only web report: `src/lib/report-view.ts` (`renderReportHtml`) + route
  `/report/[id]`. Escape all user text (XSS). Include the predictive disclaimer,
  `noindex`, and flag unverified specs / generic-fallback patterns. BLE/UWB
  sections appear only when those technologies are used.
- Share links: `src/lib/share-link.ts` — crypto random token, store only the
  hash, server-enforced expiry + revocation, read-only (no edit capability, no
  cross-project access), rate-limit validation. Never expose sequential ids or
  put sensitive data in URL fragments.
- Print/PDF: light theme by default, repeat table headers, avoid clipping,
  page numbers, EN/TH fonts, deterministic for the same snapshot, no interactive
  controls in print, expand collapsed sections before rendering. Visually inspect
  representative rendered pages in testing.
