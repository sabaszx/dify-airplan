"use client";

import { useState } from "react";
import type { Wall, WallMaterial } from "@/domain/model";
import {
  type ThicknessUnit,
  metersToThickness,
  thicknessToMeters,
  clampThicknessM,
  THICKNESS_PRESETS_M,
} from "@/lib/thickness";
import { materialColor } from "@/lib/tokens";

export type ResizeAlignment = "center" | "left" | "right";

interface Props {
  /** The primary selected wall (for single-edit fields). */
  wall: Wall;
  /** All selected walls (for bulk edit); includes `wall`. */
  selectedWalls: Wall[];
  materials: WallMaterial[];
  unit: ThicknessUnit;
  /** Configurable safe limits (meters). */
  minThicknessM?: number;
  maxThicknessM?: number;
  onChange: (mutate: (w: Wall) => void, opts?: { bulk?: boolean }) => void;
  onChangeAlignment: (a: ResizeAlignment) => void;
  alignment: ResizeAlignment;
  onDelete: () => void;
  onDuplicate: () => void;
}

/**
 * Wall properties inspector. Physical thickness is edited in real-world units
 * (numeric, slider, increment, presets) and stored in meters — separate from
 * visual width and attenuation. Supports single and bulk editing, resize
 * alignment, and material change. See override §2. Original component.
 */
export function WallProperties({
  wall,
  selectedWalls,
  materials,
  unit,
  minThicknessM = 0.01,
  maxThicknessM = 1.0,
  onChange,
  onChangeAlignment,
  alignment,
  onDelete,
  onDuplicate,
}: Props) {
  const bulk = selectedWalls.length > 1;
  const displayValue = metersToThickness(wall.thicknessM, unit);
  const [draft, setDraft] = useState<string>(displayValue.toFixed(unit === "m" ? 3 : 0));

  // Keep the draft in sync when the selected wall changes.
  const [lastId, setLastId] = useState(wall.id);
  if (lastId !== wall.id) {
    setLastId(wall.id);
    setDraft(metersToThickness(wall.thicknessM, unit).toFixed(unit === "m" ? 3 : 0));
  }

  function applyThicknessMeters(meters: number) {
    const clamped = clampThicknessM(Math.min(Math.max(meters, minThicknessM), maxThicknessM));
    onChange((w) => (w.thicknessM = clamped), { bulk });
    setDraft(metersToThickness(clamped, unit).toFixed(unit === "m" ? 3 : 0));
  }

  function commitDraft() {
    const v = Number(draft);
    if (Number.isFinite(v) && v > 0) applyThicknessMeters(thicknessToMeters(v, unit));
    else setDraft(metersToThickness(wall.thicknessM, unit).toFixed(unit === "m" ? 3 : 0));
  }

  const step =
    unit === "m" ? 0.01 : unit === "mm" ? 5 : unit === "cm" ? 0.5 : unit === "in" ? 0.25 : 0.05;
  const sliderMin = metersToThickness(minThicknessM, unit);
  const sliderMax = metersToThickness(maxThicknessM, unit);

  return (
    <div className="space-y-4 text-sm" data-testid="wall-properties">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {bulk ? `${selectedWalls.length} walls selected` : "Wall"}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-base-muted">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: materialColor(wall.materialId) }}
          />
          {wall.materialId}
        </span>
      </div>

      <div>
        <label className="label" htmlFor="wall-thickness">
          Physical thickness ({unit})
        </label>
        <div className="flex items-center gap-1">
          <button
            className="btn !px-2 !py-1"
            aria-label="Decrease thickness"
            onClick={() => applyThicknessMeters(wall.thicknessM - thicknessToMeters(step, unit))}
          >
            −
          </button>
          <input
            id="wall-thickness"
            data-testid="wall-thickness-input"
            className="input text-center"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => e.key === "Enter" && commitDraft()}
          />
          <button
            className="btn !px-2 !py-1"
            aria-label="Increase thickness"
            onClick={() => applyThicknessMeters(wall.thicknessM + thicknessToMeters(step, unit))}
          >
            +
          </button>
        </div>
        <input
          type="range"
          className="mt-2 w-full accent-accent"
          aria-label="Thickness slider"
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={Number(metersToThickness(wall.thicknessM, unit).toFixed(3))}
          onChange={(e) => applyThicknessMeters(thicknessToMeters(Number(e.target.value), unit))}
        />
        <div className="mt-0.5 text-[10px] text-base-muted">
          Stored: {wall.thicknessM.toFixed(3)} m · limits {minThicknessM}–{maxThicknessM} m. Visual
          width and attenuation are separate properties.
        </div>
      </div>

      <div>
        <label className="label">Presets</label>
        <div className="grid grid-cols-4 gap-1">
          {THICKNESS_PRESETS_M.map((p) => (
            <button
              key={p.label}
              className={`rounded border px-1 py-1 text-[11px] ${
                Math.abs(wall.thicknessM - p.meters) < 1e-6
                  ? "border-accent text-accent"
                  : "border-base-border text-base-muted hover:text-base-text"
              }`}
              onClick={() => applyThicknessMeters(p.meters)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Resize alignment</label>
        <div className="flex gap-1">
          {(["center", "left", "right"] as ResizeAlignment[]).map((a) => (
            <button
              key={a}
              className={`flex-1 rounded px-2 py-1 text-xs capitalize ${
                alignment === a
                  ? "bg-accent text-white"
                  : "border border-base-border text-base-muted hover:text-base-text"
              }`}
              onClick={() => onChangeAlignment(a)}
            >
              {a === "center" ? "Centerline" : `${a} edge`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Material {bulk ? "(applies to all selected)" : ""}</label>
        <select
          className="input"
          value={bulk ? "" : wall.materialId}
          onChange={(e) =>
            e.target.value && onChange((w) => (w.materialId = e.target.value), { bulk })
          }
        >
          {bulk && <option value="">— choose to apply —</option>}
          {materials
            .filter((m) => !("archived" in m) || !(m as { archived?: boolean }).archived)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </div>

      {!bulk && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Height (m)</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={wall.heightM}
              onChange={(e) => onChange((w) => (w.heightM = Math.max(0.1, Number(e.target.value))))}
            />
          </div>
          <div>
            <label className="label">Base elev. (m)</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={wall.bottomElevationM}
              onChange={(e) => onChange((w) => (w.bottomElevationM = Number(e.target.value)))}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn flex-1" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="btn flex-1" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
