/**
 * Antenna-pattern import pipeline + validation. Supports native JSON, CSV
 * azimuth/elevation/combined, and a best-effort MSI Planet parser. A
 * PatternImporter adapter interface allows future vendor formats without
 * touching the engine. See design.md Addendum §D.
 *
 * A 2D polar-plot IMAGE is NOT accepted as structured data (documented).
 */
import { AntennaPatternSchema, type AntennaPattern, type FrequencyPattern } from "./schema";

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface ImportResult {
  pattern: AntennaPattern | null;
  issues: ValidationIssue[];
  ok: boolean; // true if there are no error-level issues
}

export interface PatternImporter {
  format: string;
  canParse(text: string): boolean;
  parse(text: string, meta: ImportMeta): unknown;
}

export interface ImportMeta {
  manufacturer: string;
  model: string;
  antennaName: string;
  antennaType: "omnidirectional" | "sector" | "patch" | "directional" | "custom";
  frequencyMHz: number;
  peakGainDbi: number;
}

/** Validate a candidate pattern object; returns issues and a parsed pattern. */
export function validatePattern(candidate: unknown): ImportResult {
  const issues: ValidationIssue[] = [];
  const parsed = AntennaPatternSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const e of parsed.error.errors) {
      issues.push({ level: "error", code: "schema", message: `${e.path.join(".")}: ${e.message}` });
    }
    return { pattern: null, issues, ok: false };
  }
  const p = parsed.data;

  for (const fp of p.patterns) {
    if (fp.frequencyMHz < 2000 || fp.frequencyMHz > 8000) {
      issues.push({
        level: "warning",
        code: "frequency-range",
        message: `Frequency ${fp.frequencyMHz} MHz is outside typical Wi-Fi bands.`,
      });
    }
    checkCut("azimuth", fp.azimuth, issues, 0, 360);
    checkCut("elevation", fp.elevation, issues, -90, 90);
    if (Math.abs(fp.peakGainDbi) > 30) {
      issues.push({
        level: "warning",
        code: "gain-unrealistic",
        message: `Peak gain ${fp.peakGainDbi} dBi looks unrealistic; verify units are dBi.`,
      });
    }
    // 0/360 closure for azimuth
    const angles = fp.azimuth.map((s) => s.angleDeg);
    const min = Math.min(...angles);
    const max = Math.max(...angles);
    if (max - min < 300) {
      issues.push({
        level: "warning",
        code: "azimuth-coverage",
        message: "Azimuth cut does not span most of 0-360°; interpolation will be sparse.",
      });
    }
  }

  const ok = !issues.some((i) => i.level === "error");
  return { pattern: ok ? p : null, issues, ok };
}

function checkCut(
  name: string,
  samples: { angleDeg: number; gainDbi: number }[],
  issues: ValidationIssue[],
  lo: number,
  hi: number,
): void {
  const seen = new Set<number>();
  for (const s of samples) {
    if (s.angleDeg < lo - 1 || s.angleDeg > hi + 1) {
      issues.push({
        level: "warning",
        code: `${name}-angle-range`,
        message: `${name} angle ${s.angleDeg}° is outside [${lo}, ${hi}].`,
      });
    }
    if (seen.has(s.angleDeg)) {
      issues.push({
        level: "error",
        code: `${name}-duplicate-angle`,
        message: `${name} has a duplicate angle ${s.angleDeg}°.`,
      });
    }
    seen.add(s.angleDeg);
  }
}

/** Build a native pattern object from parsed cuts + metadata, then validate. */
export function buildPattern(
  meta: ImportMeta,
  azimuth: { angleDeg: number; gainDbi: number }[],
  elevation: { angleDeg: number; gainDbi: number }[],
  original?: unknown,
): ImportResult {
  const fp: FrequencyPattern = {
    frequencyMHz: meta.frequencyMHz,
    peakGainDbi: meta.peakGainDbi,
    azimuth,
    elevation,
  };
  const candidate = {
    schemaVersion: "1.0",
    id: `${meta.model}-${meta.frequencyMHz}`.replace(/\s+/g, "_"),
    revision: 0,
    manufacturer: meta.manufacturer,
    model: meta.model,
    antenna: {
      name: meta.antennaName,
      type: meta.antennaType,
      internal: true,
      polarization: "dual",
      coordinateSystem: "spherical",
      orientation: { forwardAxis: "+Y", upAxis: "+Z" },
      downtiltDeg: 0,
    },
    patterns: [fp],
    source: { type: "import", lastVerified: null },
    verificationStatus: "unverified",
    originalImport: original,
  };
  return validatePattern(candidate);
}

/** Parse a single-cut CSV of `angleDeg,gainDbi` rows (header optional). */
export function parseCsvCut(text: string): { angleDeg: number; gainDbi: number }[] {
  const rows: { angleDeg: number; gainDbi: number }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,;\t]/).map((s) => s.trim());
    const a = Number(parts[0]);
    const g = Number(parts[1]);
    if (Number.isFinite(a) && Number.isFinite(g)) rows.push({ angleDeg: a, gainDbi: g });
  }
  return rows;
}

/**
 * Combined CSV: `frequencyMHz,cut,angleDeg,gainDbi` where cut is az|el.
 * Returns az/el sample arrays for the first frequency found.
 */
export function parseCombinedCsv(text: string): {
  frequencyMHz: number;
  azimuth: { angleDeg: number; gainDbi: number }[];
  elevation: { angleDeg: number; gainDbi: number }[];
} | null {
  const az: { angleDeg: number; gainDbi: number }[] = [];
  const el: { angleDeg: number; gainDbi: number }[] = [];
  let freq = 0;
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/[,;\t]/).map((s) => s.trim().toLowerCase());
    if (parts.length < 4) continue;
    const f = Number(parts[0]);
    const cut = parts[1] ?? "";
    const a = Number(parts[2]);
    const g = Number(parts[3]);
    if (!Number.isFinite(f) || !Number.isFinite(a) || !Number.isFinite(g)) continue;
    freq = freq || f;
    if (cut.startsWith("az")) az.push({ angleDeg: a, gainDbi: g });
    else if (cut.startsWith("el")) el.push({ angleDeg: a, gainDbi: g });
  }
  if (az.length < 2 || el.length < 2) return null;
  return { frequencyMHz: freq, azimuth: az, elevation: el };
}

/**
 * Best-effort MSI Planet (.msi/.pln) parser. Reads NAME/FREQUENCY/GAIN and the
 * HORIZONTAL/VERTICAL blocks of `angle loss` rows, converting relative loss (dB)
 * to absolute dBi using the declared GAIN. This is a documented best-effort.
 */
export function parseMsi(text: string): {
  name: string;
  frequencyMHz: number;
  peakGainDbi: number;
  azimuth: { angleDeg: number; gainDbi: number }[];
  elevation: { angleDeg: number; gainDbi: number }[];
} | null {
  const lines = text.split(/\r?\n/);
  let name = "MSI Antenna";
  let freqMHz = 0;
  let gain = 0;
  const az: { angleDeg: number; gainDbi: number }[] = [];
  const el: { angleDeg: number; gainDbi: number }[] = [];
  let mode: "az" | "el" | null = null;
  let remaining = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith("NAME")) {
      name = line.slice(4).trim() || name;
      continue;
    }
    if (upper.startsWith("FREQUENCY")) {
      freqMHz = Number(line.replace(/[^0-9.]/g, "")) || freqMHz;
      continue;
    }
    if (upper.startsWith("GAIN")) {
      gain = Number((line.match(/-?\d+(\.\d+)?/) ?? ["0"])[0]);
      continue;
    }
    if (upper.startsWith("HORIZONTAL")) {
      mode = "az";
      remaining = Number(line.replace(/[^0-9]/g, "")) || 360;
      continue;
    }
    if (upper.startsWith("VERTICAL")) {
      mode = "el";
      remaining = Number(line.replace(/[^0-9]/g, "")) || 360;
      continue;
    }
    if (mode && remaining > 0) {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        const angle = parts[0]!;
        const lossDb = parts[1]!;
        const gainDbi = gain - lossDb; // MSI stores loss relative to peak gain
        if (mode === "az") az.push({ angleDeg: angle, gainDbi });
        else el.push({ angleDeg: angle > 180 ? angle - 360 : angle, gainDbi });
        remaining--;
      }
    }
  }

  if (az.length < 2) return null;
  // MSI usually gives only a horizontal cut; synthesize a minimal elevation if absent.
  const elevation =
    el.length >= 2
      ? el
      : [
          { angleDeg: -90, gainDbi: gain - 20 },
          { angleDeg: 0, gainDbi: gain },
          { angleDeg: 90, gainDbi: gain - 20 },
        ];
  return { name, frequencyMHz: freqMHz, peakGainDbi: gain, azimuth: az, elevation };
}
