# RF Model

The engine (`src/rf`) is deterministic and framework-independent. Full derivation
is in `.kiro/specs/cisco-wifi-planner/design.md` §3; this is a summary.

## Equations
- Free-space path loss (dB, meters/MHz): `FSPL = 20·log10(d) + 20·log10(f) − 27.55`.
- Log-distance: `PL(d) = PL(d0) + 10·n·log10(d/d0)`, `d0 = 1 m`, `PL(d0)` is the
  frequency-aware FSPL at 1 m; exponent `n` by environment (open 2.0, office 3.0,
  dense 3.5). Clamped to `PL(d0)` for `d < d0`.
- Received signal: `RSSI = Ptx + Gt + Gr − PL − Σ wallLoss`.
- Wall loss: sum of per-band material attenuation for every wall/opening piece
  the AP→point segment crosses, scaled by a thickness factor. Openings apply
  their own (lower) attenuation via `wallPieces`.
- Antenna gain `Gt`: model-specific pattern via 2-cut interpolation
  `G ≈ peak + (Ga(φ) − peak) + (Ge(θ) − peak)`, circular around 0/360; directional
  antennas never silently treated as omni.
- Mounting: slant distance `d = √(dh² + Δh²)`.
- Noise/SNR: `SNR = RSSI − N0`; SINR adds co/adjacent-channel interference summed
  in linear power.
- PHY/throughput/capacity: configurable lookup tables (planning estimates).

## Determinism & caching
Identical inputs → identical outputs (property-tested). Simulation cache key
includes floor/band/scenario/resolution/walls/APs and pattern revision.

## Disclaimer
Predictive estimates only — validate with an on-site survey and applicable
regulations. Not measurements.

## Verified invariants (property-based, `src/**/invariants.property.test.ts`)
Distance monotonicity, attenuation monotonicity, circular-interpolation
continuity, invalid channels never assigned, omni rotation invariance.
