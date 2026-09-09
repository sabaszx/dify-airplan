/**
 * Antenna gain computation from imported patterns. Circular interpolation across
 * 0/360, separate azimuth/elevation cuts combined via a documented additive
 * relative-to-peak approximation. A directional antenna is NEVER silently
 * treated as omnidirectional; if no validated pattern exists, a clearly-labeled
 * simplified cosine model is used. See design.md Addendum §D.1.
 *
 * The interface is shaped so a future full 3D spherical gain matrix can replace
 * `gainAt` without changing callers.
 */
import type { AntennaPattern, FrequencyPattern, AngleSample } from "./schema";

/** Normalize an angle to [0, 360). */
function norm360(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Normalize to (-180, 180]. */
function norm180(deg: number): number {
  let d = ((deg + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Circular linear interpolation of a cut at a target angle (degrees). Samples
 * need not be sorted or evenly spaced. Wraps around 0/360.
 */
export function interpolateCut(samples: AngleSample[], targetDeg: number): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0]!.gainDbi;

  const target = norm360(targetDeg);
  // Find the two samples bracketing the target on the circle.
  const sorted = [...samples]
    .map((s) => ({ a: norm360(s.angleDeg), g: s.gainDbi }))
    .sort((x, y) => x.a - y.a);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const next = sorted[(i + 1) % sorted.length]!;
    let lo = cur.a;
    let hi = next.a;
    let t = target;
    // Handle wrap segment (from last sample back to first + 360).
    if (hi <= lo) {
      hi += 360;
      if (t < lo) t += 360;
    }
    if (t >= lo && t <= hi) {
      const span = hi - lo;
      const frac = span < 1e-9 ? 0 : (t - lo) / span;
      return cur.g + (next.g - cur.g) * frac;
    }
  }
  return sorted[0]!.g;
}

export interface GainQuery {
  azimuthDeg: number; // target azimuth in antenna-local frame
  elevationDeg: number; // target elevation in antenna-local frame
  frequencyMHz: number;
}

export interface GainResult {
  gainDbi: number;
  method: "pattern" | "fallback-cosine";
  patternRevision: number | null;
  sparse: boolean;
}

/** Pick the frequency pattern nearest the query frequency. */
function selectPattern(p: AntennaPattern, freqMHz: number): FrequencyPattern {
  return p.patterns.reduce((best, cur) =>
    Math.abs(cur.frequencyMHz - freqMHz) < Math.abs(best.frequencyMHz - freqMHz) ? cur : best,
  );
}

/**
 * Effective gain (dBi) for a query. Uses the documented 2-cut combination:
 *   G(φ,θ) ≈ peak + (Ga(φ) − peak) + (Ge(θ) − peak)
 * clamped to [peak − 60, peak].
 */
export function gainFromPattern(pattern: AntennaPattern, q: GainQuery): GainResult {
  const fp = selectPattern(pattern, q.frequencyMHz);
  const ga = interpolateCut(fp.azimuth, q.azimuthDeg);
  const ge = interpolateCut(fp.elevation, q.elevationDeg);
  const peak = fp.peakGainDbi;
  let g = peak + (ga - peak) + (ge - peak);
  g = Math.max(peak - 60, Math.min(peak, g));
  const azSpan =
    Math.max(...fp.azimuth.map((s) => s.angleDeg)) - Math.min(...fp.azimuth.map((s) => s.angleDeg));
  return {
    gainDbi: g,
    method: "pattern",
    patternRevision: pattern.revision,
    sparse: azSpan < 300 || fp.azimuth.length < 8,
  };
}

/**
 * Labeled fallback when no validated pattern exists. A simplified cosine main
 * lobe — explicitly NOT omnidirectional for a directional antenna.
 */
export function fallbackGain(
  peakGainDbi: number,
  beamwidthDeg: number,
  frontToBackDb: number,
  q: GainQuery,
): GainResult {
  const delta = norm180(q.azimuthDeg);
  const half = beamwidthDeg / 2;
  let g: number;
  if (Math.abs(delta) <= half) {
    const t = delta / half;
    g = peakGainDbi - 3 * t * t;
  } else {
    const beyond = Math.min(Math.max((Math.abs(delta) - half) / (180 - half), 0), 1);
    g = peakGainDbi - 3 - (frontToBackDb - 3) * beyond;
  }
  // Elevation roll-off (mild), so a downward mount still loses some gain overhead.
  g -= Math.min(Math.abs(norm180(q.elevationDeg)) / 90, 1) * 3;
  return { gainDbi: g, method: "fallback-cosine", patternRevision: null, sparse: false };
}
