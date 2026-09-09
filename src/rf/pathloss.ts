/**
 * Path-loss model. Frequency-aware log-distance with FSPL baseline.
 * Pure functions, deterministic. See design.md §3.1–3.3.
 */

export type Band = "2.4" | "5" | "6";

/** Representative center frequency (MHz) when a specific channel is not given. */
export const BAND_CENTER_MHZ: Record<Band, number> = {
  "2.4": 2442,
  "5": 5500,
  "6": 6425,
};

/** Default path-loss exponent by environment. See design.md §3.2. */
export const PATH_LOSS_EXPONENT = {
  freeSpace: 2.0,
  office: 3.0,
  dense: 3.5,
} as const;

export type Environment = keyof typeof PATH_LOSS_EXPONENT;

/**
 * Free-space path loss (dB) for distance in meters and frequency in MHz.
 * FSPL = 20*log10(d_m) + 20*log10(f_MHz) - 27.55  (standard meters/MHz form).
 */
export function fspl(distanceMeters: number, freqMHz: number): number {
  const d = Math.max(distanceMeters, 1e-6);
  return 20 * Math.log10(d) + 20 * Math.log10(freqMHz) - 27.55;
}

/**
 * Log-distance path loss (dB). PL(d) = PL(d0) + 10*n*log10(d/d0), d0 = 1 m.
 * For d < d0 we clamp to PL(d0) to avoid singularities.
 */
export function logDistancePathLoss(
  distanceMeters: number,
  freqMHz: number,
  exponent: number,
): number {
  const d0 = 1;
  const plD0 = fspl(d0, freqMHz);
  if (distanceMeters <= d0) return plD0;
  return plD0 + 10 * exponent * Math.log10(distanceMeters / d0);
}

/** Convenience: resolve a band (or explicit channel center freq) to MHz. */
export function resolveFreqMHz(band: Band, channelCenterMHz?: number): number {
  return channelCenterMHz && channelCenterMHz > 0 ? channelCenterMHz : BAND_CENTER_MHZ[band];
}
