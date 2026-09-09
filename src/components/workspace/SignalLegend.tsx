"use client";

import { gradientLegendFor, type HeatmapMode } from "@/lib/heatmap-colors";
import type { Band } from "@/rf/pathloss";

/**
 * Bottom-right signal legend: a gradient bar with min/max + qualitative captions
 * and band toggles. Original design; the low→high color convention is a standard
 * functional signal scale.
 */
export function SignalLegend({
  mode,
  band,
  onBand,
}: {
  mode: HeatmapMode;
  band: Band;
  onBand: (b: Band) => void;
}) {
  const legend = gradientLegendFor(mode);

  return (
    <div
      className="absolute bottom-16 right-3 z-20 rounded-lg border border-base-border bg-base-panel/95 p-2.5 text-[11px] shadow-lg backdrop-blur"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
    >
      <div className="mb-1.5 flex items-center gap-1">
        <span className="mr-1 text-base-muted">Band</span>
        {(["2.4", "5", "6"] as Band[]).map((b) => (
          <button
            key={b}
            onClick={() => onBand(b)}
            className={`rounded px-1.5 py-0.5 ${band === b ? "bg-accent text-white" : "text-base-muted hover:text-base-text"}`}
          >
            {b}
          </button>
        ))}
        <span className="ml-1 text-base-muted">GHz</span>
      </div>

      {legend ? (
        <div>
          <div className="flex items-center justify-between text-base-muted">
            <span>{legend.lowCaption}</span>
            <span>{legend.highCaption}</span>
          </div>
          <div
            className="my-1 h-2.5 w-48 rounded"
            style={{ background: legend.gradientCss }}
            aria-hidden
          />
          <div className="flex items-center justify-between tabular-nums text-base-text">
            <span>{legend.minLabel}</span>
            <span>{legend.maxLabel}</span>
          </div>
        </div>
      ) : (
        <div className="w-48 text-base-muted">Categorical legend shown on the canvas.</div>
      )}
    </div>
  );
}
