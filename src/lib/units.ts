/**
 * Units library. Internal storage is SI (meters, dBm, GHz). Conversions here are
 * used ONLY for display. See design.md §2.
 */

export type LengthUnit = "m" | "ft";

const FEET_PER_METER = 3.280839895;

export function metersToFeet(m: number): number {
  return m * FEET_PER_METER;
}

export function feetToMeters(ft: number): number {
  return ft / FEET_PER_METER;
}

/** Convert a stored meter value to the display unit. */
export function toDisplayLength(meters: number, unit: LengthUnit): number {
  return unit === "ft" ? metersToFeet(meters) : meters;
}

/** Convert a user-entered display value back to stored meters. */
export function fromDisplayLength(value: number, unit: LengthUnit): number {
  return unit === "ft" ? feetToMeters(value) : value;
}

export function formatLength(meters: number, unit: LengthUnit, digits = 2): string {
  const v = toDisplayLength(meters, unit);
  return `${v.toFixed(digits)} ${unit}`;
}

/**
 * Scale calibration. Given a calibration line of pixel length `pixelLength` that
 * the user declares to be `realLength` in `unit`, compute meters-per-pixel.
 * See design.md §2.1.
 */
export function metersPerPixel(pixelLength: number, realLength: number, unit: LengthUnit): number {
  if (pixelLength <= 0) throw new Error("Calibration pixel length must be > 0");
  const meters = fromDisplayLength(realLength, unit);
  return meters / pixelLength;
}

/** dBm <-> linear milliwatt helpers (used for interference summation). */
export function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

export function mwToDbm(mw: number): number {
  if (mw <= 0) return -Infinity;
  return 10 * Math.log10(mw);
}
