---
inclusion: auto
name: rf-domain
description: Apply when creating or modifying RF prediction, heatmaps, channel planning, capacity, antenna gain, or propagation code.
---

# RF domain guidance

- The RF engine is framework-independent (`src/rf/`): no DOM, no React,
  deterministic for identical inputs.
- Use SI units: distance meters, power dBm, frequency GHz→MHz where needed.
- Model documented in `.kiro/specs/cisco-wifi-planner/design.md` (§3): FSPL
  baseline, log-distance path loss with configurable exponent, per-wall/opening
  attenuation, antenna gain via pattern interpolation, mounting slant distance,
  SNR/SINR, PHY/throughput/capacity lookup tables (planning estimates).
- Keep the engine modular so a stronger propagation model can replace
  `pathloss.ts`/`engine.ts`. New physics goes behind the existing interfaces.
- Never present predictive values as measurements; keep the disclaimer.
- Add deterministic unit tests for every behavioral change; prefer property-based
  tests for invariants (monotonicity, determinism, channel validity).

Reference: `src/rf/engine.ts`, `src/rf/pathloss.ts`, `src/rf/channel.ts`,
`src/rf/capacity.ts`.
