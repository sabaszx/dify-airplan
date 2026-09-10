"use client";

import type { Technology } from "@/rf/technology";
import {
  type LayerVisibility,
  type LayerState,
  TECH_GLYPH,
  cycleState,
  visibleTechnologies,
} from "@/lib/layer-visibility";

/**
 * Independent Wi-Fi / BLE / UWB visibility controls. Each technology has three
 * primary states (hidden / devices / devices+analysis) plus an advanced
 * analysis-only state. Keyboard accessible; distinct symbols alongside color.
 * Changing visibility never deletes devices or alters simulation config.
 * See override §5. Original UI.
 */
const STATE_LABEL: Record<LayerState, string> = {
  hidden: "Hidden",
  devices: "Devices",
  "devices-and-analysis": "Devices + analysis",
  "analysis-only": "Analysis only",
};

const TECHS: Technology[] = ["WIFI", "BLE", "UWB"];

export function LayerPanel({
  visibility,
  onChange,
}: {
  visibility: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}) {
  function setState(tech: Technology, state: LayerState) {
    onChange({ ...visibility, [tech]: state });
  }

  return (
    <div
      className="absolute right-3 top-16 z-20 w-52 rounded-lg border border-base-border bg-base-panel/95 p-2.5 text-xs shadow-lg backdrop-blur"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
      role="group"
      aria-label="Technology layer visibility"
    >
      <div className="mb-1.5 font-medium text-base-text">Layers</div>
      <ul className="space-y-1.5">
        {TECHS.map((tech) => {
          const state = visibility[tech];
          const glyph = TECH_GLYPH[tech];
          return (
            <li key={tech} className="flex items-center gap-2">
              <button
                className={`flex h-6 w-6 items-center justify-center rounded ${
                  state === "hidden" ? "text-base-muted" : "bg-accent/20 text-accent"
                }`}
                aria-pressed={state !== "hidden"}
                aria-label={`Toggle ${glyph.label} visibility`}
                title={`Cycle ${glyph.label} visibility`}
                onClick={() => setState(tech, cycleState(state))}
              >
                <span aria-hidden>{glyph.symbol}</span>
              </button>
              <span className="flex-1">{tech}</span>
              <select
                className="input !w-auto !py-0.5 !text-[11px]"
                value={state}
                aria-label={`${glyph.label} display state`}
                onChange={(e) => setState(tech, e.target.value as LayerState)}
              >
                {(
                  ["hidden", "devices", "devices-and-analysis", "analysis-only"] as LayerState[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {STATE_LABEL[s]}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      {/* Active legend: only visible technologies. */}
      <div className="mt-2 border-t border-base-border pt-2">
        <div className="mb-1 text-[10px] uppercase text-base-muted">Legend</div>
        {visibleTechnologies(visibility).length === 0 ? (
          <div className="text-[11px] text-base-muted">All layers hidden.</div>
        ) : (
          <ul className="space-y-0.5">
            {visibleTechnologies(visibility).map((tech) => (
              <li key={tech} className="flex items-center gap-1.5 text-[11px]">
                <span aria-hidden>{TECH_GLYPH[tech].symbol}</span>
                {TECH_GLYPH[tech].label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
