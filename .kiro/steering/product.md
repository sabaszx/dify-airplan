---
inclusion: always
---

# Product — Cisco Wi-Fi Planner

## Goal

A canvas-first web application for designing and evaluating Cisco wireless
access-point deployments on building floor plans, producing explainable
predictive RF heatmaps, channel/capacity plans, scenario comparisons, and
professional reports.

## Target users

Wireless network engineers, Cisco partners/presales, IT infrastructure teams,
system integrators, network consultants.

## Supported scope

Project/site/building/floor management; floor-plan upload + scale calibration;
wall editor with materials and openings; Cisco AP catalog with model-specific
antenna patterns; AP placement, editing, and model change; predictive RF engine
(2D single-floor); heatmaps; channel and capacity planning; scenario comparison;
CSV/JSON/PDF reporting with traceability.

## Unsupported / out of scope

Live Cisco controller changes (future integrations are read-only by default);
3D/inter-floor propagation; measured site-survey ingestion; authoritative Cisco
specifications (catalog is sample/unverified until imported from official docs).

## Non-negotiables

- Predictive outputs are estimates, never measurements. Always show the
  predictive disclaimer.
- Cisco specs and antenna patterns are sample/unverified unless imported from
  official manufacturer documentation with recorded provenance.
- No Cisco logos or copyrighted datasheet content; text labels only.
