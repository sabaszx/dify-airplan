/**
 * Physical wall thickness: unit-aware conversions and presets. Thickness is a
 * PHYSICAL property stored internally in METERS, separate from visual line width
 * and from RF attenuation. See override §1. Original code.
 */
export type ThicknessUnit = "mm" | "cm" | "m" | "in" | "ft";

const TO_METERS: Record<ThicknessUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
};

/** Convert a value in `unit` to meters (internal storage). */
export function thicknessToMeters(value: number, unit: ThicknessUnit): number {
  return value * TO_METERS[unit];
}

/** Convert stored meters to a display unit. */
export function metersToThickness(meters: number, unit: ThicknessUnit): number {
  return meters / TO_METERS[unit];
}

export function formatThickness(meters: number, unit: ThicknessUnit, digits = 0): string {
  const v = metersToThickness(meters, unit);
  return `${v.toFixed(digits)} ${unit}`;
}

/** Common thickness presets (meters). NOT universal construction standards. */
export const THICKNESS_PRESETS_M: { label: string; meters: number }[] = [
  { label: "75 mm", meters: 0.075 },
  { label: "90 mm", meters: 0.09 },
  { label: "100 mm", meters: 0.1 },
  { label: "125 mm", meters: 0.125 },
  { label: "150 mm", meters: 0.15 },
  { label: "200 mm", meters: 0.2 },
  { label: "250 mm", meters: 0.25 },
  { label: "300 mm", meters: 0.3 },
];

/** Clamp a thickness to a sane physical range (1 mm .. 2 m). */
export function clampThicknessM(meters: number): number {
  return Math.min(Math.max(meters, 0.001), 2);
}
