/**
 * Design tokens — original professional visual system (not any vendor's brand).
 * Consumed by Tailwind theme + components. 8px spacing base. Colorblind-safe
 * heatmap palettes with symbol/text indicators alongside color. Light, dark, and
 * high-contrast options. See requirements.md §3 / design.md Addendum §A.
 */
export const tokens = {
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 4, md: 6, lg: 10 },
  elevation: {
    low: "0 1px 2px rgba(0,0,0,0.25)",
    med: "0 4px 12px rgba(0,0,0,0.35)",
    high: "0 12px 32px rgba(0,0,0,0.45)",
  },
  z: { canvas: 0, overlay: 10, toolbar: 20, inspector: 20, header: 30, modal: 50 },
} as const;

/** Warning levels pair color with a text/symbol indicator (accessibility). */
export const warningLevels = {
  info: { symbol: "i", label: "Info", color: "#3b82f6" },
  warning: { symbol: "!", label: "Warning", color: "#f0b429" },
  error: { symbol: "×", label: "Error", color: "#ef4444" },
  ok: { symbol: "✓", label: "OK", color: "#22c55e" },
} as const;

export type WarningLevel = keyof typeof warningLevels;

/** Wall material canvas colors represent material TYPE, not RF strength. */
export const materialColors: Record<string, string> = {
  drywall: "#9aa7bd",
  "light-drywall": "#b8c2d4",
  "heavy-drywall": "#7c8aa3",
  glass: "#4fc3f7",
  "low-e-glass": "#38a3d1",
  wood: "#c08457",
  brick: "#c1614e",
  concrete: "#8d8d8d",
  "reinforced-concrete": "#5f5f5f",
  metal: "#c9a227",
  elevator: "#7a5cbf",
  custom: "#a0e0a0",
};

export function materialColor(id: string): string {
  return materialColors[id] ?? "#9aa7bd";
}
