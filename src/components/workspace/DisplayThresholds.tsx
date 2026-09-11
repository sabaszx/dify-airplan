"use client";

import { useState } from "react";
import type { Technology } from "@/rf/technology";
import {
  type DisplayCutoff,
  CUTOFF_PRESETS_DBM,
  validateCutoff,
  cutoffFor,
  metricLabel,
  belowCutoffLegend,
  DEFAULT_DISPLAY_CUTOFF,
} from "@/lib/display-cutoff";

/**
 * Canonical Display Thresholds control (Analysis inspector → Display Thresholds
 * → RSSI Cutoff). Controls what the heatmap shows; it does NOT change the
 * simulation, AP placement, or coverage requirement pass/fail. See override §2.
 * Provides an explicit, opt-in action to adopt the cutoff as a coverage
 * requirement. Original component.
 */
export function DisplayThresholds({
  cutoff,
  technology,
  band,
  requirementDbm,
  onChange,
  onUseAsRequirement,
}: {
  cutoff: DisplayCutoff;
  technology: Technology;
  band: "2.4" | "5" | "6";
  /** The coverage-requirement threshold, shown for comparison (not the cutoff). */
  requirementDbm?: number;
  onChange: (next: DisplayCutoff) => void;
  onUseAsRequirement?: (dbm: number) => void;
}) {
  const active = cutoffFor(cutoff, technology, band);
  const { label, unit } = metricLabel(technology);
  const [draft, setDraft] = useState(String(active));
  const [error, setError] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState(active);
  if (lastActive !== active) {
    setLastActive(active);
    setDraft(String(active));
    setError(null);
  }

  function setActiveValue(v: number) {
    const next = { ...cutoff };
    if (technology === "WIFI") next.wifi = { ...next.wifi, [band]: v };
    else if (technology === "BLE") next.ble = v;
    else next.uwb = v;
    onChange(next);
  }

  function commit() {
    const res = validateCutoff(draft);
    if (!res.ok || res.value === null) {
      setError(res.error ?? "Invalid value.");
      setDraft(String(active));
      return;
    }
    setError(null);
    setActiveValue(res.value);
  }

  const scopeLabel =
    technology === "WIFI" ? `Wi-Fi ${band} GHz` : technology === "BLE" ? "BLE" : "UWB";

  return (
    <div className="space-y-2 text-sm" data-testid="display-thresholds">
      <label className="label !mb-0">
        Display cutoff — {label} ({scopeLabel})
      </label>
      <div className="flex items-center gap-1">
        <button
          className="btn !px-2 !py-1"
          aria-label="Decrease cutoff"
          onClick={() => setActiveValue(active - 1)}
        >
          −
        </button>
        <input
          className="input text-center"
          data-testid="cutoff-input"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          aria-label={`${label} display cutoff in ${unit}`}
        />
        <span className="text-xs text-base-muted">{unit}</span>
        <button
          className="btn !px-2 !py-1"
          aria-label="Increase cutoff"
          onClick={() => setActiveValue(active + 1)}
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={-100}
        max={-30}
        step={1}
        value={active}
        onChange={(e) => setActiveValue(Number(e.target.value))}
        className="w-full accent-accent"
        aria-label="Cutoff slider"
      />
      {error && <p className="text-[11px] text-red-300">{error}</p>}

      <div>
        <span className="mb-1 block text-[10px] uppercase text-base-muted">
          Presets (planning references)
        </span>
        <div className="flex flex-wrap gap-1">
          {CUTOFF_PRESETS_DBM.map((p) => (
            <button
              key={p}
              className={`rounded border px-1.5 py-0.5 text-[11px] ${
                active === p
                  ? "border-accent text-accent"
                  : "border-base-border text-base-muted hover:text-base-text"
              }`}
              onClick={() => setActiveValue(p)}
            >
              {p}
            </button>
          ))}
          <button
            className="rounded border border-base-border px-1.5 py-0.5 text-[11px] text-base-muted hover:text-base-text"
            onClick={() => setActiveValue(cutoffFor(DEFAULT_DISPLAY_CUTOFF, technology, band))}
          >
            Reset
          </button>
        </div>
      </div>

      <label className="flex items-center justify-between text-xs">
        <span>Hide below-cutoff area</span>
        <input
          type="checkbox"
          checked={cutoff.hideBelow}
          onChange={(e) => onChange({ ...cutoff, hideBelow: e.target.checked })}
        />
      </label>

      <p className="rounded bg-base-bg/60 px-2 py-1 text-[10px] text-base-muted">
        {belowCutoffLegend(active, unit)} Display-only — the cutoff does not change calculated
        values or requirement pass/fail.
        {requirementDbm !== undefined && requirementDbm !== active && (
          <>
            {" "}
            Coverage requirement: {requirementDbm} {unit} (separate).
          </>
        )}
      </p>

      {onUseAsRequirement && (
        <button
          className="btn w-full !py-1 !text-xs"
          onClick={() => onUseAsRequirement(active)}
          data-testid="use-cutoff-as-requirement"
        >
          Use cutoff as coverage requirement
        </button>
      )}
    </div>
  );
}
