---
inclusion: auto
name: uwb-planning
description: Apply when creating or modifying UWB radios, UWB propagation, anchor planning, ranging-quality, or UWB visualization.
---

# UWB planning

- Enable UWB simulation only for devices with appropriate UWB radio specs +
  antenna-pattern data. Not every AP supports UWB — do not assume it.
- Use the technology-independent model (`src/rf/technology.ts`, profile `UWB`):
  HRP channels with center frequency and ~500 MHz bandwidth, its own exponent
  and receiver assumptions.
- Do NOT reuse a Wi-Fi pattern for UWB unless `isPatternCompatible` confirms the
  frequency range covers the UWB channel; otherwise labeled fallback + warning.
- NEVER claim centimeter-level accuracy from signal-strength prediction. Any
  positioning-quality analysis (anchor count / geometry / DOP-style) must be
  clearly approximate and state that accuracy depends on multipath, NLOS,
  calibration, antenna delay, clock sync, anchor geometry, body obstruction,
  orientation, and regulatory power. A site validation / PoC is required.
- Report and inspector must disclaim these limitations.
