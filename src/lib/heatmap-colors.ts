/**
 * Accessible heatmap color mapping. Uses a perceptually-ordered ramp and always
 * pairs color with numeric labels/legend (color is never the sole encoding).
 */
import type { PointResult } from "@/rf/engine";

export type HeatmapMode =
  | "rssi"
  | "snr"
  | "primary-coverage"
  | "secondary-coverage"
  | "overlap"
  | "channel"
  | "co-channel"
  | "phy-rate"
  | "throughput"
  | "capacity"
  | "coverage-pass";

export interface LegendStop {
  label: string;
  color: string;
}

// A colorblind-considerate ramp (blue -> teal -> green -> yellow -> orange -> red).
const RAMP = [
  "#2b3a67", // very weak
  "#2166ac",
  "#4393c3",
  "#35978f",
  "#7fbf7b",
  "#d9ef8b",
  "#fee08b",
  "#f46d43",
  "#d73027", // strongest
];

/** Classic signal-quality ramp: weak (red) -> strong (green). Original values. */
const COVERAGE_RAMP = [
  "#8f1d1d", // no/very weak signal
  "#c0392b",
  "#e0762d",
  "#e8b530",
  "#c9d43a",
  "#7fbf4d",
  "#3fa64d", // strong signal
];

export type Palette = "accessible" | "coverage";

function lerpHex(a: string, b: string, t: number): string {
  const pa = [
    parseInt(a.slice(1, 3), 16),
    parseInt(a.slice(3, 5), 16),
    parseInt(a.slice(5, 7), 16),
  ];
  const pb = [
    parseInt(b.slice(1, 3), 16),
    parseInt(b.slice(3, 5), 16),
    parseInt(b.slice(5, 7), 16),
  ];
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Smoothly interpolate a ramp at t in [0,1]. */
function sampleRamp(ramp: string[], t: number): string {
  const clamped = Math.min(Math.max(t, 0), 1);
  const pos = clamped * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(pos));
  return lerpHex(ramp[i]!, ramp[i + 1]!, pos - i);
}

let activePalette: Palette = "coverage";

/** Set the active heatmap palette (workspace-level). */
export function setPalette(p: Palette): void {
  activePalette = p;
}
export function getPalette(): Palette {
  return activePalette;
}

function rampColor(t: number): string {
  return sampleRamp(activePalette === "coverage" ? COVERAGE_RAMP : RAMP, t);
}

/** CSS linear-gradient string for the active palette (for gradient legends). */
export function paletteGradientCss(palette: Palette = activePalette): string {
  const ramp = palette === "coverage" ? COVERAGE_RAMP : RAMP;
  const stops = ramp.map((c, i) => `${c} ${Math.round((i / (ramp.length - 1)) * 100)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

interface ScaleSpec {
  min: number;
  max: number;
  unit: string;
}

const SCALES: Partial<Record<HeatmapMode, ScaleSpec>> = {
  rssi: { min: -90, max: -40, unit: "dBm" },
  snr: { min: 0, max: 45, unit: "dB" },
  "phy-rate": { min: 0, max: 1200, unit: "Mbps" },
  throughput: { min: 0, max: 600, unit: "Mbps" },
  capacity: { min: 0, max: 60, unit: "clients" },
  "co-channel": { min: -95, max: -60, unit: "dBm" },
};

/** Extract the scalar value used to color a cell for a given mode. */
export function cellValue(mode: HeatmapMode, r: PointResult): number | null {
  switch (mode) {
    case "rssi":
      return Number.isFinite(r.rssiDbm) ? r.rssiDbm : null;
    case "snr":
      return Number.isFinite(r.snrDb) ? r.snrDb : null;
    case "phy-rate":
      return r.phyRateMbps;
    case "throughput":
      return r.usableThroughputMbps;
    case "capacity":
      return r.estimatedClientCapacity;
    case "secondary-coverage":
      return Number.isFinite(r.secondaryRssiDbm) ? r.secondaryRssiDbm : null;
    case "co-channel":
      return Number.isFinite(r.coChannelDbm) ? r.coChannelDbm : null;
    case "overlap":
      return r.audibleApCount;
    default:
      return Number.isFinite(r.rssiDbm) ? r.rssiDbm : null;
  }
}

export function colorFor(mode: HeatmapMode, r: PointResult, minThreshold?: number): string | null {
  if (mode === "coverage-pass") {
    if (!Number.isFinite(r.rssiDbm)) return null;
    const pass = r.rssiDbm >= (minThreshold ?? -67);
    return pass ? "#1a9850" : "#d73027";
  }
  if (mode === "primary-coverage") {
    if (!Number.isFinite(r.rssiDbm)) return null;
    return r.rssiDbm >= (minThreshold ?? -67) ? "#4393c3" : "#2b3a67";
  }
  if (mode === "overlap") {
    const n = r.audibleApCount;
    return rampColor(Math.min(n / 4, 1));
  }
  if (mode === "channel") {
    if (!r.bestApId) return null;
    // Stable hue per serving AP id.
    let h = 0;
    for (const ch of r.bestApId) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${h} 60% 55%)`;
  }

  const v = cellValue(mode, r);
  if (v === null) return null;
  const scale = SCALES[mode] ?? SCALES.rssi!;
  if (minThreshold !== undefined && v < minThreshold) return null;
  const t = (v - scale.min) / (scale.max - scale.min);
  return rampColor(t);
}

export function legendFor(mode: HeatmapMode): LegendStop[] {
  if (mode === "coverage-pass" || mode === "primary-coverage") {
    return [
      { label: "Pass", color: "#1a9850" },
      { label: "Fail", color: "#d73027" },
    ];
  }
  if (mode === "channel") {
    return [{ label: "Color = serving AP", color: "hsl(210 60% 55%)" }];
  }
  const scale = SCALES[mode] ?? SCALES.rssi!;
  const stops: LegendStop[] = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const value = scale.min + t * (scale.max - scale.min);
    stops.push({ label: `${Math.round(value)} ${scale.unit}`, color: rampColor(t) });
  }
  return stops;
}

export interface GradientLegend {
  gradientCss: string;
  minLabel: string;
  maxLabel: string;
  unit: string;
  /** Qualitative caption, e.g. "Weak" / "Great signal". */
  lowCaption: string;
  highCaption: string;
}

/** Continuous gradient-bar legend for a scalar mode (RSSI/SNR/rate/…). */
export function gradientLegendFor(mode: HeatmapMode): GradientLegend | null {
  const scale = SCALES[mode];
  if (!scale) return null;
  const captions: Partial<Record<HeatmapMode, [string, string]>> = {
    rssi: ["Weak", "Great signal"],
    snr: ["Poor SNR", "Excellent SNR"],
    "phy-rate": ["Low rate", "High rate"],
    throughput: ["Low", "High"],
    capacity: ["Few", "Many"],
    "co-channel": ["Low interf.", "High interf."],
  };
  const [lowCaption, highCaption] = captions[mode] ?? ["Low", "High"];
  return {
    gradientCss: paletteGradientCss(),
    minLabel: `${scale.min} ${scale.unit}`,
    maxLabel: `${scale.max} ${scale.unit}`,
    unit: scale.unit,
    lowCaption,
    highCaption,
  };
}
