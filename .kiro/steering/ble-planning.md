---
inclusion: auto
name: ble-planning
description: Apply when creating or modifying BLE radios, BLE propagation, BLE coverage/visualization, or BLE requirement profiles.
---

# BLE planning

- Enable BLE simulation only for devices with adequate BLE radio + antenna-pattern
  information. Not every Cisco AP supports BLE — do not assume it.
- Use the technology-independent model (`src/rf/technology.ts`, profile `BLE`):
  2.4 GHz, advertising channels 37/38/39, its own path-loss exponent and
  receiver assumptions.
- Do NOT reuse a Wi-Fi antenna pattern for BLE unless `isPatternCompatible`
  (`src/antenna/compatibility.ts`) confirms the documented frequency range
  covers the target; otherwise use the labeled generic fallback and warn.
- Predicted BLE RSSI is NOT guaranteed positioning accuracy; keep the disclaimer.
- Every BLE threshold (detectability/telemetry/proximity/asset-tracking) is an
  editable, documented assumption.
- The point inspector must state technology, transmitter, frequency, pattern,
  path/wall loss, received power, threshold result, and limitations.
