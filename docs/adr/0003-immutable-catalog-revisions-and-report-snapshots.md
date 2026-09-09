# ADR 0003: Immutable catalog/pattern revisions and report snapshots

- Status: Accepted
- Date: 2026

## Context
Catalog and antenna-pattern data will change over time. Existing project
simulations and exported reports must remain reproducible.

## Decision
Treat product and antenna-pattern revisions as immutable; publishing changes
creates a new revision. Each AP stores a `catalogSnapshot`. Reports capture a
self-contained `ReportSnapshot` (revisions, calculation settings, a deep copy of
the scenario, and provenance flags) — see `src/lib/report-snapshot.ts`.

## Consequences
- A later catalog update never silently changes an existing project or report
  (property/unit tested).
- Some data duplication in snapshots (acceptable for auditability).
- Model changes go through an explicit, undoable compatibility flow.
