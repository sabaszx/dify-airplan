/**
 * Antenna-pattern compatibility for a target technology/frequency. A Wi-Fi
 * pattern is NOT reused for BLE/UWB unless its documented frequency range covers
 * the target frequency and the compatibility is explicit. Otherwise a clearly
 * labeled generic fallback is used. See override §5. Original code.
 */
import type { AntennaPattern } from "./schema";
import type { Technology } from "@/rf/technology";
import { resolveTechFreqMHz } from "@/rf/technology";

export interface CompatibilityResult {
  compatible: boolean;
  reason: string;
  /** Whether callers must use a labeled generic fallback instead. */
  useFallback: boolean;
}

/** Tolerance (fraction) allowed between a pattern's frequency and the target. */
const FREQ_TOLERANCE = 0.15;

/**
 * Check whether `pattern` may be used for `technology` at `channelId`.
 * The pattern is compatible only if one of its frequency samples is within a
 * documented tolerance of the target frequency.
 */
export function isPatternCompatible(
  pattern: AntennaPattern,
  technology: Technology,
  channelId?: string,
): CompatibilityResult {
  const targetMHz = resolveTechFreqMHz(technology, channelId);
  const freqs = pattern.patterns.map((p) => p.frequencyMHz);
  const nearest = freqs.reduce(
    (best, f) => (Math.abs(f - targetMHz) < Math.abs(best - targetMHz) ? f : best),
    freqs[0] ?? 0,
  );
  const withinRange = Math.abs(nearest - targetMHz) <= targetMHz * FREQ_TOLERANCE;

  if (withinRange) {
    return {
      compatible: true,
      reason: `Pattern frequency ${nearest} MHz is within tolerance of the ${technology} target ${Math.round(targetMHz)} MHz.`,
      useFallback: false,
    };
  }
  return {
    compatible: false,
    reason: `Pattern frequency ${nearest} MHz does not cover the ${technology} target ${Math.round(targetMHz)} MHz. A Wi-Fi pattern is not reused for ${technology} without verified frequency coverage.`,
    useFallback: true,
  };
}

export const CROSS_TECH_FALLBACK_WARNING =
  "No compatible antenna pattern for this technology/frequency. Using a labeled generic fallback; directional accuracy is limited. Verify with manufacturer documentation.";
