/**
 * Display cutoff for signal heatmaps. This is a VISUALIZATION mask only:
 * cells whose displayed metric is below the cutoff are hidden (or drawn with a
 * "below-cutoff" style). It NEVER changes calculated values, AP placement, the
 * simulation, or coverage requirement pass/fail. See override §2. Original code.
 *
 * Terminology (kept distinct, override §2.3):
 *  - Display cutoff       → what is visible (this module)
 *  - Coverage requirement → pass/fail (domain Thresholds / CoverageRequirement)
 *  - Receiver sensitivity → whether reception is theoretically possible
 *  - Color-scale minimum  → visualization range
 */
import type { Technology } from "@/rf/technology";

/** Wi-Fi cutoff is per band; BLE/UWB use one technology-specific received-power
 *  threshold (labeled with the correct unit, not necessarily "RSSI"). */
export interface DisplayCutoff {
  wifi: { "2.4": number; "5": number; "6": number };
  /** BLE received signal strength cutoff (dBm). */
  ble: number;
  /** UWB received power cutoff (dBm). */
  uwb: number;
  /** Whether to hide below-cutoff cells (true) or draw them in belowStyle. */
  hideBelow: boolean;
  /** Optional CSS color for below-cutoff cells when not hidden. */
  belowColor?: string;
}

export const DEFAULT_DISPLAY_CUTOFF: DisplayCutoff = {
  wifi: { "2.4": -75, "5": -72, "6": -72 },
  ble: -85,
  uwb: -90,
  hideBelow: true,
};

/** Editable planning-reference presets (dBm) — NOT universal requirements. */
export const CUTOFF_PRESETS_DBM = [-55, -60, -65, -67, -70, -75, -80];

/** RF-engine supported display range (dBm). Used for validation. */
export const CUTOFF_MIN_DBM = -110;
export const CUTOFF_MAX_DBM = -20;

export interface CutoffValidation {
  ok: boolean;
  value: number | null;
  error?: string;
}

/** Validate a cutoff value against the supported safe range. */
export function validateCutoff(raw: unknown): CutoffValidation {
  const v = typeof raw === "number" ? raw : Number(raw);
  if (raw === "" || raw === null || raw === undefined || Number.isNaN(v)) {
    return { ok: false, value: null, error: "Enter a numeric dBm value." };
  }
  if (!Number.isFinite(v)) {
    return { ok: false, value: null, error: "Value must be finite." };
  }
  if (v < CUTOFF_MIN_DBM || v > CUTOFF_MAX_DBM) {
    return {
      ok: false,
      value: null,
      error: `Value must be between ${CUTOFF_MIN_DBM} and ${CUTOFF_MAX_DBM} dBm.`,
    };
  }
  return { ok: true, value: v };
}

/** The cutoff (dBm) that applies for a technology + Wi-Fi band. */
export function cutoffFor(
  cutoff: DisplayCutoff,
  technology: Technology,
  band: "2.4" | "5" | "6",
): number {
  switch (technology) {
    case "WIFI":
      return cutoff.wifi[band];
    case "BLE":
      return cutoff.ble;
    case "UWB":
      return cutoff.uwb;
    default:
      return cutoff.wifi[band];
  }
}

/** True when a value passes the display cutoff (i.e. should be shown). */
export function passesCutoff(valueDbm: number, cutoffDbm: number): boolean {
  // Values >= cutoff remain visible; below are masked (override §2).
  return Number.isFinite(valueDbm) && valueDbm >= cutoffDbm;
}

/** Correct metric label + unit per technology (do not mislabel BLE/UWB as RSSI). */
export function metricLabel(technology: Technology): { label: string; unit: string } {
  switch (technology) {
    case "WIFI":
      return { label: "RSSI", unit: "dBm" };
    case "BLE":
      return { label: "BLE RSSI", unit: "dBm" };
    case "UWB":
      return { label: "UWB received power", unit: "dBm" };
    default:
      return { label: "Signal", unit: "dBm" };
  }
}

/** Human-readable legend line when values are hidden. */
export function belowCutoffLegend(cutoffDbm: number, unit = "dBm"): string {
  return `Values below ${cutoffDbm} ${unit} are hidden.`;
}
