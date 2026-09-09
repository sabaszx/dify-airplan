"use client";

import { useState } from "react";
import type { Palette } from "@/lib/heatmap-colors";

/**
 * Floating visualization panel: coverage/wall/floor-plan opacity, display
 * toggles, AP icon size, and palette selection. Original dark card, collapsible,
 * positioned over the canvas. Functional layout inspired by professional
 * coverage planners; visual design is original.
 */
export interface VizSettings {
  coverageOpacity: number; // 0..1
  wallOpacity: number; // 0..1
  floorPlanOpacity: number; // 0..1
  showApNames: boolean;
  showChannels: boolean;
  showGrid: boolean;
  iconSize: number; // px
  palette: Palette;
}

export function VisualizationPanel({
  settings,
  onChange,
}: {
  settings: VizSettings;
  onChange: (next: Partial<VizSettings>) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        className="absolute left-3 top-16 z-20 rounded-md border border-base-border bg-base-panel/95 px-2 py-1.5 text-xs text-base-muted shadow-lg hover:text-base-text"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
        onClick={() => setCollapsed(false)}
        title="Show visualization settings"
      >
        ▤ Display
      </button>
    );
  }

  return (
    <div
      className="absolute left-3 top-16 z-20 w-56 rounded-lg border border-base-border bg-base-panel/95 p-3 text-xs shadow-lg backdrop-blur"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
      role="group"
      aria-label="Visualization settings"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-base-text">Display</span>
        <button
          className="text-base-muted hover:text-base-text"
          onClick={() => setCollapsed(true)}
          title="Collapse"
        >
          ‹
        </button>
      </div>

      <Slider
        label="Coverage opacity"
        value={settings.coverageOpacity}
        onChange={(v) => onChange({ coverageOpacity: v })}
      />
      <Slider
        label="Walls opacity"
        value={settings.wallOpacity}
        onChange={(v) => onChange({ wallOpacity: v })}
      />
      <Slider
        label="Floor-plan opacity"
        value={settings.floorPlanOpacity}
        onChange={(v) => onChange({ floorPlanOpacity: v })}
      />

      <div className="my-2 h-px bg-base-border" />

      <Toggle
        label="AP names"
        checked={settings.showApNames}
        onChange={(v) => onChange({ showApNames: v })}
      />
      <Toggle
        label="Channels"
        checked={settings.showChannels}
        onChange={(v) => onChange({ showChannels: v })}
      />
      <Toggle
        label="Grid"
        checked={settings.showGrid}
        onChange={(v) => onChange({ showGrid: v })}
      />

      <div className="my-2 h-px bg-base-border" />

      <label className="mb-1 block text-base-muted">AP icon size</label>
      <input
        type="range"
        min={6}
        max={16}
        value={settings.iconSize}
        onChange={(e) => onChange({ iconSize: Number(e.target.value) })}
        className="w-full accent-accent"
        aria-label="AP icon size"
      />

      <label className="mb-1 mt-2 block text-base-muted">Palette</label>
      <div className="flex gap-1">
        {(["coverage", "accessible"] as Palette[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange({ palette: p })}
            className={`flex-1 rounded px-2 py-1 capitalize ${
              settings.palette === p
                ? "bg-accent text-white"
                : "border border-base-border text-base-muted hover:text-base-text"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <button
        className="mt-3 w-full text-left text-[11px] text-accent hover:underline"
        onClick={() =>
          onChange({
            coverageOpacity: 0.75,
            wallOpacity: 1,
            floorPlanOpacity: 0.9,
            showApNames: true,
            showChannels: false,
            showGrid: true,
            iconSize: 9,
            palette: "coverage",
          })
        }
      >
        Restore defaults
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-base-muted">{label}</span>
        <span className="tabular-nums text-base-text">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
        aria-label={label}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-1.5 flex cursor-pointer items-center justify-between">
      <span className="text-base-muted">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-8 rounded-full transition-colors ${checked ? "bg-accent" : "bg-base-border"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
