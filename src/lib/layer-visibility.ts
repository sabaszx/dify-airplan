/**
 * Independent per-technology layer visibility (Wi-Fi / BLE / UWB). A pure model
 * so it is testable and can drive both the 2D canvas and the 3D view. Visibility
 * NEVER deletes devices or changes simulation configuration — it only controls
 * what is drawn. Persisted per view (localStorage). See override §5. Original code.
 */
import type { Technology } from "@/rf/technology";

/** Three primary states + an advanced "analysis only" state. */
export type LayerState = "hidden" | "devices" | "devices-and-analysis" | "analysis-only";

export type LayerVisibility = Record<Technology, LayerState>;

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  WIFI: "devices-and-analysis",
  BLE: "hidden",
  UWB: "hidden",
};

/** Distinct accessible symbol + label per technology (color is never the only cue). */
export const TECH_GLYPH: Record<Technology, { symbol: string; label: string }> = {
  WIFI: { symbol: "▲", label: "Wi-Fi AP" },
  BLE: { symbol: "◆", label: "BLE beacon" },
  UWB: { symbol: "⬢", label: "UWB anchor" },
};

/** Should device icons/labels for a technology be drawn? */
export function showsDevices(v: LayerVisibility, tech: Technology): boolean {
  const s = v[tech];
  return s === "devices" || s === "devices-and-analysis";
}

/** Should the analysis overlay (heatmap/coverage) for a technology be drawn? */
export function showsAnalysis(v: LayerVisibility, tech: Technology): boolean {
  const s = v[tech];
  return s === "devices-and-analysis" || s === "analysis-only";
}

/** Technologies that have anything visible (for the active legend). */
export function visibleTechnologies(v: LayerVisibility): Technology[] {
  return (Object.keys(v) as Technology[]).filter((t) => v[t] !== "hidden");
}

/** Cycle a technology through the three primary states (control click). */
export function cycleState(current: LayerState): LayerState {
  switch (current) {
    case "hidden":
      return "devices";
    case "devices":
      return "devices-and-analysis";
    case "devices-and-analysis":
      return "hidden";
    default:
      return "devices-and-analysis";
  }
}

const KEY = "cwp:layer-visibility";

/** Load per-view visibility from localStorage; falls back to defaults. */
export function loadLayerVisibility(): LayerVisibility {
  if (typeof window === "undefined") return { ...DEFAULT_LAYER_VISIBILITY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_LAYER_VISIBILITY };
    const parsed = JSON.parse(raw) as Partial<LayerVisibility>;
    return { ...DEFAULT_LAYER_VISIBILITY, ...parsed };
  } catch {
    return { ...DEFAULT_LAYER_VISIBILITY };
  }
}

export function saveLayerVisibility(v: LayerVisibility): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(v));
}
