# Reporting

See `.kiro/steering/reporting.md`. The reporting core is `src/lib/report-snapshot.ts`
(reproducible snapshot) and `src/lib/export.ts` (CSV/JSON/HTML output).

## Reproducibility
`buildReportSnapshot` captures every input needed to reproduce a report even if
the live catalog/patterns/project change later: report id, timestamp, generating
user, RF-engine version, catalog data version, project/scenario revisions,
calculation settings (grid resolution, bands, environment, noise floor,
efficiency), BOM, product usage (with datasheet URLs + revisions), pattern usage
(with fallback flags), a deep copy of the scenario, and transparency flags.

## Content
Cover page, document control, executive summary, project/site info, objectives,
scope/exclusions, regulatory assumptions, scale/ceiling assumptions, wall
materials, client/application profiles, coverage requirements, model-selection
summary, per-floor placement, per-band RSSI/SNR heatmaps, primary/secondary
coverage, channel plan, power plan, interference, capacity, compliance, issues,
AP configuration schedule, switch-port planning, BOM, product/pattern sources,
limitations/disclaimer, sign-off, appendices.

## Transparency
Every report flags: unverified specs, generic-fallback patterns, manually
digitized patterns, user overrides, missing manufacturer info, and regulatory
assumptions, plus the predictive disclaimer.

## Export formats
Implemented: PDF (print pipeline via `reportHtml`), CSV (AP inventory, BOM),
JSON (project snapshot, placement, report snapshot), PNG floor-plan/heatmap
images. Future-compatible: DOCX, XLSX, shareable read-only web report.

## Status / gaps
The full 29-section PDF layout, the interactive report-builder UI, a
server-side PDF renderer, and automated visual PDF inspection are specified but
only partially implemented; the reproducible snapshot + export functions and the
HTML report are done and unit-tested. A `PdfRenderer` seam allows swapping in a
server renderer later.
