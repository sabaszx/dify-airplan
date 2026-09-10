"use client";

import { useMemo, useRef, useState } from "react";
import type { WallMaterial, AttenuationSample } from "@/domain/model";
import {
  validateMaterial,
  createMaterial,
  updateMaterial,
  duplicateMaterial,
  archiveMaterial,
  restoreMaterial,
  searchMaterials,
  exportMaterialsJson,
  importMaterialsJson,
  type MaterialValidation,
} from "@/domain/material-library";
import { materialColor } from "@/lib/tokens";

/**
 * Custom material library panel: add / edit / duplicate / archive / restore,
 * per-technology/frequency attenuation in dB with validation, and JSON
 * import/export. Attenuation is separate from physical thickness. Original UI.
 */
interface Props {
  materials: WallMaterial[];
  onSave: (materials: WallMaterial[]) => void;
}

const TECHS: AttenuationSample["technology"][] = ["WIFI", "BLE", "UWB"];

export function MaterialLibraryPanel({ materials, onSave }: Props) {
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<WallMaterial | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => searchMaterials(materials, query, includeArchived),
    [materials, query, includeArchived],
  );

  function commit(next: WallMaterial[]) {
    onSave(next);
  }

  function startNew() {
    setEditing(createMaterial({ name: "New material", source: "" }));
  }

  function saveEditing(m: WallMaterial) {
    const exists = materials.some((x) => x.id === m.id);
    commit(exists ? materials.map((x) => (x.id === m.id ? m : x)) : [...materials, m]);
    setEditing(null);
  }

  function onImport(file: File) {
    file.text().then((text) => {
      const res = importMaterialsJson(text);
      if (res.materials.length) {
        const byId = new Map(materials.map((m) => [m.id, m] as const));
        for (const m of res.materials) byId.set(m.id, m);
        commit([...byId.values()]);
      }
      if (res.errors.length)
        alert(`Imported with ${res.errors.length} skipped: ${res.errors.join("; ")}`);
    });
  }

  if (editing) {
    return (
      <MaterialEditor material={editing} onCancel={() => setEditing(null)} onSave={saveEditing} />
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-1">
        <input
          className="input flex-1"
          placeholder="Search materials…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search materials"
        />
        <button className="btn btn-primary !py-1 !text-xs" onClick={startNew}>
          + Add
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
        />
        Show archived
      </label>

      <ul className="space-y-1">
        {filtered.length === 0 && (
          <li className="py-3 text-center text-xs text-base-muted">No materials.</li>
        )}
        {filtered.map((m) => (
          <li
            key={m.id}
            className={`rounded border border-base-border p-2 ${m.archived ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: m.displayColor ?? materialColor(m.id) }}
                />
                <span className="font-medium">{m.name}</span>
                {m.verificationStatus && (
                  <span className="rounded bg-yellow-500/20 px-1 text-[9px] text-yellow-200">
                    {m.verificationStatus}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-base-muted">v{m.version ?? 1}</span>
            </div>
            <div className="mt-1 text-[10px] text-base-muted">
              2.4/5/6 GHz: {m.attenuationDb["2.4"]}/{m.attenuationDb["5"]}/{m.attenuationDb["6"]} dB
              {m.attenuationSamples?.length ? ` · ${m.attenuationSamples.length} samples` : ""}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
              <button className="btn !px-2 !py-0.5" onClick={() => setEditing(m)}>
                Edit
              </button>
              <button
                className="btn !px-2 !py-0.5"
                onClick={() => commit([...materials, duplicateMaterial(m)])}
              >
                Duplicate
              </button>
              {m.archived ? (
                <button
                  className="btn !px-2 !py-0.5"
                  onClick={() =>
                    commit(materials.map((x) => (x.id === m.id ? restoreMaterial(x) : x)))
                  }
                >
                  Restore
                </button>
              ) : (
                <button
                  className="btn !px-2 !py-0.5"
                  onClick={() =>
                    commit(materials.map((x) => (x.id === m.id ? archiveMaterial(x) : x)))
                  }
                >
                  Archive
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex gap-1 border-t border-base-border pt-2 text-xs">
        <button
          className="btn flex-1 !py-1"
          onClick={() => {
            const blob = new Blob([exportMaterialsJson(materials)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "materials.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export JSON
        </button>
        <button className="btn flex-1 !py-1" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
        />
      </div>
      <p className="text-[10px] text-base-muted">
        Attenuation is entered in dB and is independent of physical wall thickness unless a
        thickness-dependent model is chosen.
      </p>
    </div>
  );
}

function MaterialEditor({
  material,
  onCancel,
  onSave,
}: {
  material: WallMaterial;
  onCancel: () => void;
  onSave: (m: WallMaterial) => void;
}) {
  const [draft, setDraft] = useState<WallMaterial>(material);
  const validation: MaterialValidation = validateMaterial(draft);

  function set<K extends keyof WallMaterial>(key: K, value: WallMaterial[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setBand(band: "2.4" | "5" | "6", value: number) {
    setDraft((d) => ({ ...d, attenuationDb: { ...d.attenuationDb, [band]: value } }));
  }
  function addSample() {
    setDraft((d) => ({
      ...d,
      attenuationSamples: [
        ...(d.attenuationSamples ?? []),
        { technology: "WIFI", frequencyMHz: 5500, lossDb: 10 },
      ],
    }));
  }
  function updateSample(i: number, patch: Partial<AttenuationSample>) {
    setDraft((d) => ({
      ...d,
      attenuationSamples: (d.attenuationSamples ?? []).map((s, idx) =>
        idx === i ? { ...s, ...patch } : s,
      ),
    }));
  }
  function removeSample(i: number) {
    setDraft((d) => ({
      ...d,
      attenuationSamples: (d.attenuationSamples ?? []).filter((_, idx) => idx !== i),
    }));
  }

  return (
    <div className="space-y-3 text-sm" data-testid="material-editor">
      <div className="flex items-center justify-between">
        <span className="font-medium">Edit material</span>
        <button className="text-base-muted hover:text-base-text" onClick={onCancel}>
          ✕
        </button>
      </div>

      <div>
        <label className="label">Name</label>
        <input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Display color</label>
          <input
            type="color"
            className="input !p-0.5"
            value={draft.displayColor ?? "#8d8d8d"}
            onChange={(e) => set("displayColor", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Default thickness (m)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.defaultThicknessM ?? 0.1}
            onChange={(e) => set("defaultThicknessM", Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className="label">Legacy per-band loss (dB)</label>
        <div className="grid grid-cols-3 gap-1">
          {(["2.4", "5", "6"] as const).map((b) => (
            <div key={b}>
              <span className="text-[10px] text-base-muted">{b} GHz</span>
              <input
                type="number"
                className="input"
                value={draft.attenuationDb[b]}
                onChange={(e) => setBand(b, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="label !mb-0">Attenuation samples (dB)</label>
          <button className="btn !px-2 !py-0.5 !text-xs" onClick={addSample}>
            + Sample
          </button>
        </div>
        {(draft.attenuationSamples ?? []).map((s, i) => (
          <div key={i} className="mb-1 flex items-center gap-1">
            <select
              className="input !w-auto !py-1"
              value={s.technology}
              onChange={(e) =>
                updateSample(i, { technology: e.target.value as AttenuationSample["technology"] })
              }
            >
              {TECHS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              placeholder="MHz"
              value={s.frequencyMHz}
              onChange={(e) => updateSample(i, { frequencyMHz: Number(e.target.value) })}
            />
            <input
              className="input"
              type="number"
              placeholder="dB"
              value={s.lossDb}
              onChange={(e) => updateSample(i, { lossDb: Number(e.target.value) })}
            />
            <button
              className="btn !px-2 !py-1"
              aria-label="Remove sample"
              onClick={() => removeSample(i)}
            >
              −
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className="label">Source</label>
        <input
          className="input"
          placeholder="e.g. manufacturer datasheet URL"
          value={draft.source ?? ""}
          onChange={(e) => set("source", e.target.value)}
        />
      </div>

      {validation.issues.length > 0 && (
        <div className="rounded border border-base-border p-2 text-[11px]">
          {validation.issues.map((iss, idx) => (
            <div key={idx} className={iss.level === "error" ? "text-red-300" : "text-yellow-200"}>
              {iss.level === "error" ? "×" : "!"} {iss.message}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-primary flex-1"
          disabled={!validation.ok}
          data-testid="save-material"
          onClick={() => onSave(updateMaterial(draft, draft))}
        >
          Save
        </button>
      </div>
    </div>
  );
}
