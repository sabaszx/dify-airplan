"use client";

import { useState } from "react";
import {
  validatePattern,
  buildPattern,
  parseCsvCut,
  parseCombinedCsv,
  parseMsi,
  type ImportResult,
  type ValidationIssue,
} from "@/antenna/import";
import type { AntennaPattern } from "@/antenna/schema";
import { PolarPlot } from "./PolarPlot";

/**
 * Antenna-pattern import + preview panel. Accepts native JSON, CSV cuts,
 * combined CSV, or MSI, validates before save, shows errors/warnings and a live
 * polar preview with rotation. Invalid patterns are not saved (may be kept as a
 * draft). See requirements.md §6.2–6.5.
 */
export function PatternImportPanel({ onSave }: { onSave?: (p: AntennaPattern) => void }) {
  const [format, setFormat] = useState<"json" | "csv-combined" | "csv-az" | "msi">("json");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rotation, setRotation] = useState(0);
  const [freqIndex, setFreqIndex] = useState(0);
  const [meta, setMeta] = useState({
    manufacturer: "Cisco",
    model: "Imported Antenna",
    antennaName: "External",
    frequencyMHz: 5500,
    peakGainDbi: 8,
  });

  async function onFile(file: File) {
    const text = await file.text();
    try {
      if (format === "json") {
        setResult(validatePattern(JSON.parse(text)));
      } else if (format === "csv-combined") {
        const parsed = parseCombinedCsv(text);
        if (!parsed) {
          setResult({
            pattern: null,
            ok: false,
            issues: [
              {
                level: "error",
                code: "csv",
                message: "Combined CSV needs az and el rows (freq,cut,angle,gain).",
              },
            ],
          });
          return;
        }
        setResult(
          buildPattern(
            {
              ...meta,
              antennaType: "directional",
              frequencyMHz: parsed.frequencyMHz || meta.frequencyMHz,
            },
            parsed.azimuth,
            parsed.elevation,
            { source: "csv-combined" },
          ),
        );
      } else if (format === "csv-az") {
        const az = parseCsvCut(text);
        // Synthesize a minimal elevation cut so the pattern validates; flagged as a warning.
        const el = [
          { angleDeg: -90, gainDbi: meta.peakGainDbi - 15 },
          { angleDeg: 0, gainDbi: meta.peakGainDbi },
          { angleDeg: 90, gainDbi: meta.peakGainDbi - 15 },
        ];
        setResult(buildPattern({ ...meta, antennaType: "sector" }, az, el, { source: "csv-az" }));
      } else if (format === "msi") {
        const parsed = parseMsi(text);
        if (!parsed) {
          setResult({
            pattern: null,
            ok: false,
            issues: [
              {
                level: "error",
                code: "msi",
                message: "Could not parse MSI file (expected NAME/FREQUENCY/GAIN/HORIZONTAL).",
              },
            ],
          });
          return;
        }
        setResult(
          buildPattern(
            {
              ...meta,
              antennaType: "sector",
              frequencyMHz: parsed.frequencyMHz || meta.frequencyMHz,
              peakGainDbi: parsed.peakGainDbi,
            },
            parsed.azimuth,
            parsed.elevation,
            { source: "msi" },
          ),
        );
      }
    } catch (err) {
      setResult({
        pattern: null,
        ok: false,
        issues: [
          {
            level: "error",
            code: "parse",
            message: `Failed to parse file: ${(err as Error).message}`,
          },
        ],
      });
    }
  }

  const pattern = result?.pattern;
  const fp = pattern?.patterns[freqIndex] ?? pattern?.patterns[0];

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md border border-base-border p-2 text-[11px] text-base-muted">
        Import a structured antenna pattern. A 2D polar-plot image is not accepted as data. Values
        remain unverified until confirmed against manufacturer documentation.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Format</label>
          <select
            className="input"
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
          >
            <option value="json">Native JSON</option>
            <option value="csv-combined">Combined CSV</option>
            <option value="csv-az">Azimuth CSV</option>
            <option value="msi">MSI Planet</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="btn btn-primary w-full cursor-pointer justify-center text-xs">
            Choose file
            <input
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {format !== "json" && (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input"
            value={meta.model}
            onChange={(e) => setMeta({ ...meta, model: e.target.value })}
            placeholder="Model"
          />
          <input
            className="input"
            type="number"
            value={meta.peakGainDbi}
            onChange={(e) => setMeta({ ...meta, peakGainDbi: Number(e.target.value) })}
            placeholder="Peak gain dBi"
          />
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <ValidationSummary issues={result.issues} ok={result.ok} />

          {fp && (
            <>
              {pattern!.patterns.length > 1 && (
                <select
                  className="input"
                  value={freqIndex}
                  onChange={(e) => setFreqIndex(Number(e.target.value))}
                >
                  {pattern!.patterns.map((p, i) => (
                    <option key={i} value={i}>
                      {p.frequencyMHz} MHz
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-around">
                <PolarPlot
                  samples={fp.azimuth}
                  peakGainDbi={fp.peakGainDbi}
                  rotationDeg={rotation}
                  label="Azimuth"
                  size={160}
                />
                <PolarPlot
                  samples={fp.elevation}
                  peakGainDbi={fp.peakGainDbi}
                  label="Elevation"
                  size={160}
                />
              </div>
              <div>
                <label className="label">Preview rotation: {rotation}°</label>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              className="btn btn-primary flex-1"
              disabled={!result.ok || !pattern}
              onClick={() => pattern && onSave?.(pattern)}
            >
              Save pattern
            </button>
            {!result.ok && pattern === null && result.issues.length > 0 && (
              <span className="self-center text-[11px] text-red-300">
                Fix errors before saving.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationSummary({ issues, ok }: { issues: ValidationIssue[]; ok: boolean }) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return (
    <div className="rounded-md border border-base-border p-2 text-[11px]">
      <div className="mb-1 font-medium">
        {ok ? (
          <span className="text-green-400">✓ Valid — {warnings.length} warning(s)</span>
        ) : (
          <span className="text-red-400">
            × {errors.length} error(s), {warnings.length} warning(s)
          </span>
        )}
      </div>
      <ul className="space-y-0.5">
        {errors.map((e, i) => (
          <li key={`e${i}`} className="text-red-300">
            × {e.message}
          </li>
        ))}
        {warnings.map((w, i) => (
          <li key={`w${i}`} className="text-yellow-200">
            ! {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
