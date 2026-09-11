/**
 * Custom material library: validation, versioning, and CRUD helpers. Pure and
 * framework-independent (no React). Attenuation is always in dB. Physical
 * thickness stays separate from attenuation. See override §3. Original code.
 */
import { WallMaterialSchema, type WallMaterial, type AttenuationSample } from "./model";

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface MaterialValidation {
  ok: boolean; // true when no error-level issues
  issues: ValidationIssue[];
}

const HIGH_LOSS_WARN_DB = 40;

/**
 * Validate a material's attenuation values and metadata. Rejects NaN/Infinity
 * and (by default) negative loss; detects duplicate frequency samples; warns on
 * unusually high loss; and flags missing source. `allowNegative` is the advanced
 * administrator override. See override §3.1.
 */
export function validateMaterial(
  material: Partial<WallMaterial>,
  opts: { allowNegative?: boolean } = {},
): MaterialValidation {
  const issues: ValidationIssue[] = [];

  if (!material.name || material.name.trim() === "") {
    issues.push({ level: "error", code: "name-required", message: "Material name is required." });
  }

  // Legacy per-band values must be finite.
  if (material.attenuationDb) {
    for (const key of ["2.4", "5", "6"] as const) {
      const v = material.attenuationDb[key];
      checkLoss(`band ${key} GHz`, v, issues, opts.allowNegative);
    }
  }

  // Explicit samples: finite, dB units implied, no duplicates per tech.
  const samples = material.attenuationSamples ?? [];
  const seen = new Set<string>();
  for (const s of samples) {
    checkLoss(`${s.technology} @ ${s.frequencyMHz} MHz`, s.lossDb, issues, opts.allowNegative);
    if (!Number.isFinite(s.frequencyMHz) || s.frequencyMHz <= 0) {
      issues.push({
        level: "error",
        code: "frequency-invalid",
        message: `Frequency for ${s.technology} must be a positive number.`,
      });
    }
    const dupKey = `${s.technology}|${s.frequencyMHz}`;
    if (seen.has(dupKey)) {
      issues.push({
        level: "error",
        code: "duplicate-sample",
        message: `Duplicate ${s.technology} sample at ${s.frequencyMHz} MHz.`,
      });
    }
    seen.add(dupKey);
  }

  // Thickness sanity.
  const { minThicknessM, maxThicknessM, defaultThicknessM } = material;
  if (minThicknessM !== undefined && maxThicknessM !== undefined && minThicknessM > maxThicknessM) {
    issues.push({
      level: "error",
      code: "thickness-range",
      message: "Minimum thickness cannot exceed maximum thickness.",
    });
  }
  if (
    defaultThicknessM !== undefined &&
    ((minThicknessM !== undefined && defaultThicknessM < minThicknessM) ||
      (maxThicknessM !== undefined && defaultThicknessM > maxThicknessM))
  ) {
    issues.push({
      level: "warning",
      code: "default-out-of-range",
      message: "Default thickness is outside the min/max range.",
    });
  }

  // Provenance: require a source or the record is unverified.
  if (!material.source || material.source.trim() === "") {
    issues.push({
      level: "warning",
      code: "no-source",
      message: "No source recorded; this material will be marked unverified.",
    });
  }

  const ok = !issues.some((i) => i.level === "error");
  return { ok, issues };
}

function checkLoss(
  label: string,
  v: number | undefined,
  issues: ValidationIssue[],
  allowNegative = false,
): void {
  if (v === undefined) return;
  if (!Number.isFinite(v)) {
    issues.push({
      level: "error",
      code: "loss-not-finite",
      message: `${label}: loss must be a finite dB value (no NaN/Infinity).`,
    });
    return;
  }
  if (v < 0 && !allowNegative) {
    issues.push({
      level: "error",
      code: "loss-negative",
      message: `${label}: negative loss requires an explicit advanced override.`,
    });
  }
  if (v > HIGH_LOSS_WARN_DB) {
    issues.push({
      level: "warning",
      code: "loss-high",
      message: `${label}: ${v} dB is unusually high — verify.`,
    });
  }
}

/** Effective loss (dB) a material would apply for a technology/frequency, using
 *  explicit samples when present (nearest frequency), else the legacy band. */
export function effectiveSampleLossDb(
  material: WallMaterial,
  technology: AttenuationSample["technology"],
  frequencyMHz: number,
): number {
  const samples = (material.attenuationSamples ?? []).filter((s) => s.technology === technology);
  if (samples.length > 0) {
    const nearest = samples.reduce((best, s) =>
      Math.abs(s.frequencyMHz - frequencyMHz) < Math.abs(best.frequencyMHz - frequencyMHz)
        ? s
        : best,
    );
    return nearest.lossDb;
  }
  // Fall back to the nearest legacy Wi-Fi band value.
  if (frequencyMHz < 3000) return material.attenuationDb["2.4"];
  if (frequencyMHz < 6000) return material.attenuationDb["5"];
  return material.attenuationDb["6"];
}

let seq = 0;
function materialId(name: string): string {
  seq += 1;
  return `mat_${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}_${seq.toString(36)}${Date.now().toString(36)}`;
}

/** Create a new material with audit/version stamps. */
export function createMaterial(
  partial: Partial<WallMaterial>,
  now = new Date().toISOString(),
  createdBy = "user",
): WallMaterial {
  const name = partial.name ?? "Custom Material";
  const base: WallMaterial = {
    id: partial.id ?? materialId(name),
    name,
    attenuationDb: partial.attenuationDb ?? { "2.4": 5, "5": 7, "6": 9 },
    isDefault: false,
    description: partial.description,
    displayColor: partial.displayColor,
    displayPattern: partial.displayPattern ?? "solid",
    defaultThicknessM: partial.defaultThicknessM ?? 0.1,
    minThicknessM: partial.minThicknessM ?? 0.01,
    maxThicknessM: partial.maxThicknessM ?? 1.0,
    wallHeightDefaultM: partial.wallHeightDefaultM ?? 2.7,
    models: partial.models,
    attenuationSamples: partial.attenuationSamples,
    source: partial.source,
    verificationStatus: partial.source
      ? (partial.verificationStatus ?? "user-entered")
      : "user-entered",
    notes: partial.notes,
    version: 1,
    createdBy,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
  return WallMaterialSchema.parse(base);
}

/** Produce an updated material with a bumped version + updatedAt. */
export function updateMaterial(
  material: WallMaterial,
  changes: Partial<WallMaterial>,
  now = new Date().toISOString(),
): WallMaterial {
  return WallMaterialSchema.parse({
    ...material,
    ...changes,
    id: material.id, // id is immutable
    version: (material.version ?? 1) + 1,
    updatedAt: now,
  });
}

/** Duplicate a material as a new, unarchived record with a fresh id. */
export function duplicateMaterial(
  material: WallMaterial,
  now = new Date().toISOString(),
): WallMaterial {
  return createMaterial(
    { ...material, id: undefined, name: `${material.name} (copy)`, isDefault: false },
    now,
  );
}

export function archiveMaterial(
  material: WallMaterial,
  now = new Date().toISOString(),
): WallMaterial {
  return updateMaterial(material, { archived: true }, now);
}
export function restoreMaterial(
  material: WallMaterial,
  now = new Date().toISOString(),
): WallMaterial {
  return updateMaterial(material, { archived: false }, now);
}

/** Filter/search helper for the library UI (pure). */
export function searchMaterials(
  materials: WallMaterial[],
  query: string,
  includeArchived = false,
): WallMaterial[] {
  const q = query.trim().toLowerCase();
  return materials.filter((m) => {
    if (!includeArchived && m.archived) return false;
    if (!q) return true;
    return `${m.name} ${m.description ?? ""} ${m.source ?? ""}`.toLowerCase().includes(q);
  });
}

/** Export materials as pretty JSON (import format). */
export function exportMaterialsJson(materials: WallMaterial[]): string {
  return JSON.stringify({ schemaVersion: "1.0", materials }, null, 2);
}

export interface ImportResult {
  materials: WallMaterial[];
  errors: string[];
}

/** Import materials from a JSON string; invalid entries are reported, not thrown. */
export function importMaterialsJson(text: string): ImportResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { materials: [], errors: ["File is not valid JSON."] };
  }
  const arr =
    parsed && typeof parsed === "object" && "materials" in parsed
      ? (parsed as { materials: unknown[] }).materials
      : Array.isArray(parsed)
        ? parsed
        : [];
  const out: WallMaterial[] = [];
  arr.forEach((raw, i) => {
    const res = WallMaterialSchema.safeParse(raw);
    if (res.success) out.push(res.data);
    else errors.push(`Material #${i + 1} is invalid and was skipped.`);
  });
  return { materials: out, errors };
}

/* -------------------------------------------------------------------------- */
/* Permission model (pure)                                                    */
/* -------------------------------------------------------------------------- */

/** Roles that govern who may change the material library. Framework-independent
 *  so it can be enforced client-side now and server-side once the API is wired
 *  (see security steering). Original code. */
export type MaterialRole = "viewer" | "editor" | "admin";

export type MaterialAction = "create" | "edit" | "duplicate" | "archive" | "delete" | "import";

/** Capability check: which actions a role may perform. Deleting (hard removal)
 *  and the negative-loss override are admin-only; editors can create/edit/
 *  duplicate/archive/import; viewers are read-only. */
export function canPerform(role: MaterialRole, action: MaterialAction): boolean {
  switch (role) {
    case "admin":
      return true;
    case "editor":
      return action !== "delete";
    case "viewer":
      return false;
    default:
      return false;
  }
}

/** Only admins may enter the advanced negative-loss (gain) override. */
export function allowsNegativeLoss(role: MaterialRole): boolean {
  return role === "admin";
}

/* -------------------------------------------------------------------------- */
/* Save helper (new vs edit) with authorization + validation                  */
/* -------------------------------------------------------------------------- */

export interface SaveMaterialOptions {
  role?: MaterialRole;
  by?: string;
  now?: string;
}

export interface SaveMaterialResult {
  ok: boolean;
  materials: WallMaterial[];
  error?: string;
  validation?: MaterialValidation;
}

/**
 * Insert or update a material in a library array. Enforces role permission,
 * validates dB values, and bumps the revision ONLY for edits to an existing
 * record (a brand-new material stays at version 1). Returns a new array; never
 * mutates the input. This is the single write path the UI and any future API
 * should call. See override §5.
 */
export function saveMaterial(
  materials: WallMaterial[],
  draft: WallMaterial,
  opts: SaveMaterialOptions = {},
): SaveMaterialResult {
  const role = opts.role ?? "editor";
  const now = opts.now ?? new Date().toISOString();
  const exists = materials.some((m) => m.id === draft.id);
  const action: MaterialAction = exists ? "edit" : "create";

  if (!canPerform(role, action)) {
    return { ok: false, materials, error: `Your role (${role}) cannot ${action} materials.` };
  }

  const validation = validateMaterial(draft, { allowNegative: allowsNegativeLoss(role) });
  if (!validation.ok) {
    return { ok: false, materials, error: "Material has validation errors.", validation };
  }

  if (!exists) {
    // New record: stamp author/timestamps once, keep version 1.
    const created = createMaterial(draft, now, opts.by ?? draft.createdBy ?? "user");
    return { ok: true, materials: [...materials, created], validation };
  }

  // Existing record: bump the revision and record the editor/time.
  const next = materials.map((m) =>
    m.id === draft.id ? updateMaterial(m, { ...draft, createdBy: m.createdBy }, now) : m,
  );
  return { ok: true, materials: next, validation };
}
