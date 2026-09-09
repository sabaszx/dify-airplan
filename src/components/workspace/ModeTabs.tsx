"use client";

import type { HeatmapMode } from "@/lib/heatmap-colors";

/**
 * Floating analysis-mode tabs near the top-center of the canvas. Switches the
 * active heatmap metric (or turns the overlay off). Original pill design.
 */
const MODES: { id: HeatmapMode | "off"; label: string; glyph: string }[] = [
  { id: "rssi", label: "Coverage", glyph: "📶" },
  { id: "snr", label: "SNR", glyph: "◈" },
  { id: "capacity", label: "Capacity", glyph: "☰" },
  { id: "off", label: "Off", glyph: "○" },
];

export function ModeTabs({
  active,
  onChange,
}: {
  active: HeatmapMode | "off";
  onChange: (m: HeatmapMode | "off") => void;
}) {
  return (
    <div
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-base-border bg-base-panel/95 p-1 text-xs shadow-lg backdrop-blur"
      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
      role="tablist"
      aria-label="Analysis mode"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={active === m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
            active === m.id ? "bg-accent text-white" : "text-base-muted hover:text-base-text"
          }`}
        >
          <span aria-hidden>{m.glyph}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
