/**
 * Antenna gain and directional pattern. Deterministic. See design.md §3.5.
 */
import { normalizeDeg } from "./geometry";

export interface AntennaConfig {
  /** Peak/boresight gain in dBi. */
  gainDbi: number;
  /** True for omnidirectional (integrated indoor APs). */
  omnidirectional: boolean;
  /** Boresight azimuth in degrees (clockwise from +X), only for directional. */
  boresightDeg?: number;
  /** Half-power beamwidth in degrees (directional only). */
  beamwidthDeg?: number;
  /** Front-to-back ratio in dB (directional only). */
  frontToBackDb?: number;
}

/**
 * Effective antenna gain (dBi) toward a target azimuth.
 * Omnidirectional returns peak gain uniformly.
 * Directional uses a cosine-tapered main lobe: -3 dB at half-beamwidth,
 * falling to (peak - FBR) behind the array.
 */
export function effectiveGain(cfg: AntennaConfig, targetAzimuthDeg: number): number {
  if (cfg.omnidirectional) return cfg.gainDbi;

  const boresight = cfg.boresightDeg ?? 0;
  const bw = cfg.beamwidthDeg ?? 65;
  const fbr = cfg.frontToBackDb ?? 25;

  const delta = normalizeDeg(targetAzimuthDeg - boresight);
  const half = bw / 2;

  if (Math.abs(delta) <= half) {
    // Parabolic taper reaching -3 dB at the beam edge.
    const t = delta / half; // in [-1, 1]
    return cfg.gainDbi - 3 * t * t;
  }

  // Outside the main lobe: interpolate from -3 dB (at edge) toward -FBR (at 180°).
  const beyond = (Math.abs(delta) - half) / (180 - half); // 0..1
  const clamped = Math.min(Math.max(beyond, 0), 1);
  return cfg.gainDbi - 3 - (fbr - 3) * clamped;
}
