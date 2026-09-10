# Requirements — Cisco Wi-Fi Planner (MVP)

> Status: Living document. EARS-style acceptance criteria.
> Notation: **WHEN** `<trigger>` **THE SYSTEM SHALL** `<response>` / **WHILE** `<state>` / **IF** `<condition>` **THEN**.

## 0. Product Vision

A desktop-first web application that lets network engineers plan Cisco wireless
deployments on building floor plans: upload plans, calibrate scale, draw walls,
place and configure access points, generate explainable predictive RF heatmaps,
plan channels and capacity, compare scenarios, and export professional reports.

All RF outputs are **predictive planning estimates**, not measurements.

---

## 1. Project Management

**User story:** As a network engineer, I want to organize my work into projects
so that I can manage multiple customer deployments.

- 1.1 WHEN a user creates a project THE SYSTEM SHALL persist it with name,
  customer, location, owner, and a created/modified timestamp.
- 1.2 WHEN a user renames, duplicates, archives, or deletes a project THE SYSTEM
  SHALL apply the change and update the modified timestamp.
- 1.3 THE SYSTEM SHALL display, per project card: name, customer, location,
  number of floors, AP count, owner, and last-modified time.
- 1.4 WHEN a user edits any project data THE SYSTEM SHALL autosave with a visible
  save-status indicator (saving / saved / error).
- 1.5 WHEN a user requests export THE SYSTEM SHALL produce a JSON backup; WHEN a
  user imports valid JSON THE SYSTEM SHALL restore the project.
- 1.6 IF a destructive action is requested (delete/archive) THEN THE SYSTEM SHALL
  require explicit confirmation.

## 2. Floor-Plan Workspace

**User story:** As an engineer, I want an interactive canvas so I can design on a
real floor plan.

- 2.1 WHEN a user uploads a PNG, JPEG, SVG, or PDF THE SYSTEM SHALL validate MIME
  type and size and set it as the floor background.
- 2.2 IF the upload is a PDF THEN THE SYSTEM SHALL let the user select a page and
  rasterize it to a background image.
- 2.3 THE SYSTEM SHALL support zoom, pan, fit-to-screen, reset, and an optional grid.
- 2.4 WHEN a user calibrates scale by drawing a line and entering its real length
  THE SYSTEM SHALL compute meters-per-pixel and store it on the floor.
- 2.5 THE SYSTEM SHALL support meters and feet for display, storing meters internally.
- 2.6 THE SYSTEM SHALL allow setting ceiling height, locking the background, and
  adjusting background opacity.
- 2.7 THE SYSTEM SHALL support multiple floors per building.
- 2.8 THE SYSTEM SHALL store all object coordinates in real-world meters.

## 3. Walls & Attenuation

**User story:** As an engineer, I want to model walls so predictions account for
signal loss.

- 3.1 WHEN a user draws connected wall segments THE SYSTEM SHALL support point
  snapping and store the polyline in meters.
- 3.2 THE SYSTEM SHALL provide starter materials (Drywall, Glass, Concrete,
  Reinforced Concrete, Brick, Wood, Metal, Elevator Shaft, Custom) with per-band
  attenuation (2.4/5/6 GHz) labeled **planning defaults, editable**.
- 3.3 THE SYSTEM SHALL support wall editing: move/add/remove point, change
  material, change thickness, duplicate, delete, multi-select, undo/redo.

## 4. Cisco AP Catalog

**User story:** As a presales engineer, I want a Cisco AP catalog so I can pick
appropriate models.

- 4.1 THE SYSTEM SHALL store AP specifications as catalog data (JSON/DB), not
  hardcoded UI logic, with a catalog-data version and last-verified date.
- 4.2 THE SYSTEM SHALL seed representative Wi-Fi 6, 6E, and 7 models and SHALL
  flag every unverified value with `verified=false` and a data-source label.
- 4.3 THE SYSTEM SHALL display "Verify with official Cisco documentation" in reports.
- 4.4 THE SYSTEM SHALL NOT use Cisco logos; it SHALL use text labels and neutral
  placeholder images.

## 5. AP Placement & Configuration

- 5.1 WHEN a user drags an AP from the catalog onto the canvas THE SYSTEM SHALL
  create an AP instance at that meter coordinate.
- 5.2 THE SYSTEM SHALL support move, rotate, duplicate, delete, and bulk edit.
- 5.3 THE SYSTEM SHALL let the user set mounting type (ceiling/wall/pole/outdoor)
  and mounting height.
- 5.4 THE SYSTEM SHALL configure 2.4/5/6 GHz radios independently: enable/disable,
  channel or Auto, channel width, transmit power or Auto, antenna gain (custom).
- 5.5 WHEN a user selects a directional antenna THE SYSTEM SHALL render a beam overlay.
- 5.6 IF a setting conflicts with the selected model THEN THE SYSTEM SHALL show a warning.
- 5.7 THE SYSTEM SHALL store AP name, asset tag, switch name/port, IP, notes, install status.

## 6. Predictive RF Engine

- 6.1 THE SYSTEM SHALL compute received signal (dBm) at each grid point using
  frequency-aware log-distance path loss plus per-wall attenuation, antenna gain
  and direction, transmit power, and mounting-height adjustment.
- 6.2 At each grid point THE SYSTEM SHALL compute: RSSI, best/secondary serving AP,
  noise floor, SNR, co-channel and adjacent-channel interference approximations,
  audible AP count, PHY-rate range, usable throughput, estimated client capacity,
  and coverage pass/fail.
- 6.3 THE SYSTEM SHALL be deterministic: identical inputs produce identical outputs.
- 6.4 THE SYSTEM SHALL run simulation in a Web Worker with Draft/Standard/High
  resolution modes, progress, and cancellation.
- 6.5 THE SYSTEM SHALL cache results keyed by floor, band, scenario, grid
  resolution, walls, and AP configuration, and recompute after a debounce.
- 6.6 THE SYSTEM SHALL display: "Predictive estimates only. Validate the final
  design with an on-site survey and applicable regulatory requirements."

## 7. Heatmaps & Analysis

- 7.1 THE SYSTEM SHALL provide heatmap modes: RSSI, SNR, primary coverage,
  secondary coverage, AP overlap, channel assignment, co-channel interference,
  PHY rate, throughput, client capacity, coverage pass/fail.
- 7.2 THE SYSTEM SHALL provide controls: band, client profile, opacity, minimum
  threshold, color legend, AP labels, wall loss, grid cells.
- 7.3 THE SYSTEM SHALL provide editable default thresholds (data/voice/high-density
  RSSI, min SNR, min secondary, max clients/AP, min throughput).
- 7.4 WHEN a band's radio is disabled THE SYSTEM SHALL exclude it from heatmaps.

## 8. Channel Planning

- 8.1 THE SYSTEM SHALL assign channels per band respecting the selected regulatory
  domain and channel width, and SHALL NOT assign unsupported channels.
- 8.2 THE SYSTEM SHALL allow enabling/disabling DFS channels.
- 8.3 THE SYSTEM SHALL minimize co-channel neighbors, penalize adjacent overlap,
  display a reason per recommendation, and allow user overrides.
- 8.4 THE SYSTEM SHALL treat regulatory rules as configurable data and warn users
  to verify current local regulations (incl. Thailand / 6 GHz).

## 9. Capacity Planning

- 9.1 THE SYSTEM SHALL let users draw requirement zones with area name, users,
  devices/user, concurrency %, application profile, throughput/client, min RSSI,
  min SNR, secondary coverage, preferred bands, client capabilities.
- 9.2 THE SYSTEM SHALL compute concurrent clients, aggregate demand, AP
  utilization, airtime warnings, coverage gaps, overloaded APs, and suggested
  additional APs, all labeled as estimates.

## 10. Scenario Comparison

- 10.1 THE SYSTEM SHALL support scenarios and cloning.
- 10.2 THE SYSTEM SHALL compare AP count, coverage, capacity pass rate, uncovered
  area, and BOM side by side, and SHALL support promoting a scenario to baseline.

## 11. Reporting & Export

- 11.1 THE SYSTEM SHALL generate a PDF report with project info, assumptions,
  floor plans, AP placements, heatmap snapshots, coverage & capacity stats,
  channel/power plan, AP config table, warnings, BOM, data sources, and disclaimer.
- 11.2 THE SYSTEM SHALL export AP inventory CSV, BOM CSV, project JSON, placement
  JSON, and an annotated floor-plan image.
- 11.3 THE SYSTEM SHALL ensure the exported BOM matches the selected scenario and
  the PDF reflects the correct floor and AP count.

## 12. UX & Non-Functional

- 12.1 THE SYSTEM SHALL be responsive (desktop-optimized workspace) with keyboard
  shortcuts (select/pan/wall/AP/delete/duplicate/undo/redo/escape).
- 12.2 THE SYSTEM SHALL provide context menus, multi-select, copy/paste, undo/redo
  history, toasts, empty states, skeletons, and destructive-action confirmation.
- 12.3 THE SYSTEM SHALL use accessible color + text labels and provide EN/TH
  localization structure.
- 12.4 THE SYSTEM SHALL validate uploads (MIME/size), sanitize filenames and SVG,
  authorize per-project/asset access, prevent cross-org access, and rate-limit
  expensive simulate/export endpoints.

## 13. Definition of Done

The MVP is done when a user can: create a project; upload & calibrate a plan;
draw ≥3 wall types; place & configure multiple Cisco AP models; generate
2.4/5/6 GHz RSSI & SNR heatmaps; inspect a point result; view coverage gaps &
capacity warnings; get an automatic channel recommendation; compare two
scenarios; export a PDF report and CSV BOM; reload without data loss; and pass
critical Playwright flows.

---

## 14. Canvas-First UX & Extensibility Override (supersedes conflicts)

**User story:** As an engineer, I want a canvas-first tool as usable as
professional RF planners, with fast continuous wall drawing and an extensible
antenna model.

- 14.1 THE SYSTEM SHALL use a five-region shell: compact header (44-52px), left
  nav rail, central canvas, floating bottom toolbar, floating dockable inspector.
- 14.2 WHEN the wall tool is active THE SYSTEM SHALL let the user draw a
  connected polyline without reselecting the tool, finishing on double-click or
  Enter, cancelling the current segment on Escape (once) and exiting on Escape
  (twice), removing the last vertex on Backspace, constraining angle with Shift,
  disabling snap with Alt, and accepting numeric length/angle entry.
- 14.3 THE SYSTEM SHALL snap wall vertices to endpoints, segments, grid, axes,
  and common angles, with visible snap targets, consistent across zoom levels.
- 14.4 THE SYSTEM SHALL show live segment length, total length, and angle while
  drawing, and editable length/angle labels after creation.
- 14.5 THE SYSTEM SHALL keep the same wall material selected after finishing a
  wall, and provide a quick material palette (colors represent material, not RF).
- 14.6 THE SYSTEM SHALL support wall editing: drag wall, drag vertex, insert
  vertex, remove vertex, split, join, change material (incl. bulk), thickness,
  height; and openings that stay attached to their parent wall.
- 14.7 THE SYSTEM SHALL implement each mutation as a command with
  execute/undo/redo/serialize/label/affectedIds/invalidationBounds, coalescing a
  drag into one undoable action.
- 14.8 THE SYSTEM SHALL support an extensible antenna-pattern model (product,
  SKU, radio, antenna, pattern, regulatory profile, mounting) importable from
  JSON/CSV/MSI without changing engine or UI source, with validation summaries
  and verification states (draft/sample/unverified/verified/deprecated/archived).
- 14.9 THE SYSTEM SHALL apply antenna orientation, mounting, downtilt, and
  directional gain in the RF engine using circular interpolation; it SHALL NEVER
  silently treat a directional antenna as omnidirectional; pattern revision is
  part of the simulation cache key.
- 14.10 THE SYSTEM SHALL clearly distinguish verified, unverified, and sample
  product/pattern data throughout the UI and reports.
- 14.11 THE SYSTEM SHALL support AP library placement (cards, search/filter,
  continuous placement, replace-preserving-location) and expose radio/antenna
  settings immediately on placement.

---

## 15. Wall thickness, materials, hierarchy, visibility, 3D (override)

**User story:** As an engineer I want editable physical wall thickness, a custom
material library, an explicit floor hierarchy, independent technology visibility,
and a 3D view derived from the 2D design.

- 15.1 WHEN a user edits a wall THE SYSTEM SHALL allow changing physical thickness
  (numeric/slider/increment/presets/bulk) stored in meters and displayed in
  mm/cm/m/in/ft; changing zoom SHALL NOT change stored thickness; changing
  thickness SHALL NOT change attenuation unless the material uses a
  thickness-dependent model.
- 15.2 THE SYSTEM SHALL provide resize alignment (centerline/left/right).
- 15.3 THE SYSTEM SHALL provide a material library: add/edit/duplicate/archive/
  restore, per-technology/frequency attenuation in dB, validation (reject
  NaN/Infinity/negative unless overridden, duplicate frequencies, require a
  source or mark unverified), versioning, and JSON import/export.
- 15.4 THE SYSTEM SHALL model an Area/Site/Building/Floor hierarchy; Building and
  Floor SHALL be explicit; floors SHALL order by explicit sortOrder/elevation,
  never by string name; users SHALL add/duplicate/archive/delete floors; delete
  SHALL be refused for a floor referenced by an immutable report snapshot.
- 15.5 THE SYSTEM SHALL provide independent Wi-Fi/BLE/UWB visibility states
  (hidden / devices / devices+analysis / analysis-only), keyboard-accessible,
  with distinct symbols, persisted per view; visibility SHALL NOT delete devices
  or change simulation configuration, and SHALL work in 2D and 3D.
- 15.6 THE SYSTEM SHALL provide a 3D view derived from the SAME 2D data (no
  separate 3D model), extruding walls by physical thickness+height and stacking
  floors at their real elevations, with Floor/Building/Split modes and selection
  sync; a 3D failure or missing WebGL SHALL NOT crash the 2D editor.
- 15.7 THE SYSTEM SHALL open existing (pre-migration) projects via
  backward-compatible migrations (legacy walls receive a documented default
  thickness; floors are placed under a valid building).
- 15.8 THE SYSTEM SHALL render error boundaries at the route, editor, and 3D
  levels; malformed persisted state SHALL yield a localized error, not a crash.
