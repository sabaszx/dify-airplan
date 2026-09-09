/**
 * Sample model-specific antenna-pattern library. Patterns are SAMPLE data and
 * flagged accordingly (verificationStatus: "sample"). Real deployments should
 * import verified patterns from official manufacturer documentation. Model names
 * are used only as neutral keys; no datasheet content is reproduced here.
 * See override §4 and §5.
 */
import type { AntennaPattern } from "./schema";

function omniPattern(
  id: string,
  model: string,
  band: string,
  freqMHz: number,
  peak: number,
): AntennaPattern {
  // Near-omni azimuth with a mild elevation roll-off.
  const azimuth = Array.from({ length: 12 }, (_, i) => ({ angleDeg: i * 30, gainDbi: peak }));
  const elevation = [
    { angleDeg: -90, gainDbi: peak - 12 },
    { angleDeg: -45, gainDbi: peak - 4 },
    { angleDeg: 0, gainDbi: peak },
    { angleDeg: 45, gainDbi: peak - 4 },
    { angleDeg: 90, gainDbi: peak - 12 },
  ];
  return {
    schemaVersion: "1.0",
    id,
    revision: 1,
    manufacturer: "Cisco",
    model,
    antenna: {
      name: `Integrated ${band} GHz`,
      type: "omnidirectional",
      internal: true,
      polarization: "dual",
      coordinateSystem: "spherical",
      orientation: { forwardAxis: "+Y", upAxis: "+Z" },
      downtiltDeg: 0,
    },
    patterns: [{ frequencyMHz: freqMHz, peakGainDbi: peak, azimuth, elevation }],
    source: { type: "sample", lastVerified: null },
    verificationStatus: "sample",
    notes: "Sample model-specific pattern. Verify against official Cisco documentation.",
  };
}

function sectorPattern(
  id: string,
  model: string,
  band: string,
  freqMHz: number,
  peak: number,
  bw: number,
): AntennaPattern {
  const azimuth: { angleDeg: number; gainDbi: number }[] = [];
  for (let a = 0; a < 360; a += 15) {
    const delta = a > 180 ? a - 360 : a;
    const half = bw / 2;
    let g: number;
    if (Math.abs(delta) <= half) g = peak - 3 * (delta / half) ** 2;
    else g = peak - 3 - 22 * Math.min((Math.abs(delta) - half) / (180 - half), 1);
    azimuth.push({ angleDeg: a, gainDbi: Math.round(g * 10) / 10 });
  }
  const elevation = [
    { angleDeg: -90, gainDbi: peak - 20 },
    { angleDeg: -30, gainDbi: peak - 6 },
    { angleDeg: 0, gainDbi: peak },
    { angleDeg: 30, gainDbi: peak - 6 },
    { angleDeg: 90, gainDbi: peak - 20 },
  ];
  return {
    schemaVersion: "1.0",
    id,
    revision: 1,
    manufacturer: "Cisco",
    model,
    antenna: {
      name: `Directional ${band} GHz`,
      type: "sector",
      internal: false,
      polarization: "dual",
      coordinateSystem: "spherical",
      orientation: { forwardAxis: "+Y", upAxis: "+Z" },
      downtiltDeg: 0,
    },
    patterns: [
      {
        frequencyMHz: freqMHz,
        peakGainDbi: peak,
        azimuth,
        elevation,
        beamwidthDeg: bw,
        frontToBackDb: 25,
      },
    ],
    source: { type: "sample", lastVerified: null },
    verificationStatus: "sample",
    notes:
      "Sample model-specific directional pattern. Verify against official Cisco documentation.",
  };
}

const FREQ: Record<string, number> = { "2.4": 2442, "5": 5500, "6": 6425 };

/** Keyed sample library: `${model}|${band}|${antenna}`. */
export const PATTERN_LIBRARY: Record<string, AntennaPattern> = {};

function register(model: string, bands: string[], directional: boolean) {
  for (const band of bands) {
    const peak = band === "2.4" ? 3 : band === "5" ? 5 : 6;
    if (directional) {
      const id = `${model}-${band}-external`;
      PATTERN_LIBRARY[`${model}|${band}|external`] = sectorPattern(
        id,
        model,
        band,
        FREQ[band]!,
        peak + 3,
        75,
      );
    } else {
      const id = `${model}-${band}-integrated`;
      PATTERN_LIBRARY[`${model}|${band}|integrated`] = omniPattern(
        id,
        model,
        band,
        FREQ[band]!,
        peak,
      );
    }
  }
}

// Seed a few representative model-specific patterns (sample data).
register("Catalyst 9130", ["2.4", "5"], false);
register("Catalyst 9166", ["2.4", "5", "6"], false);
register("Catalyst 9124 (Outdoor)", ["2.4", "5"], true);
register("Catalyst 9166D1", ["2.4", "5", "6"], true);
register("Wireless 9179F (Outdoor)", ["2.4", "5", "6"], true);

/** Explicitly-labeled generic fallback (never used silently). */
export function genericFallbackPattern(
  band: string,
  directional: boolean,
  peakGainDbi: number,
): AntennaPattern {
  const freq = FREQ[band] ?? 5500;
  return directional
    ? sectorPattern("GENERIC", "Generic fallback", band, freq, peakGainDbi, 65)
    : omniPattern("GENERIC", "Generic fallback", band, freq, peakGainDbi);
}
