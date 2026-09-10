import { describe, it, expect } from "vitest";
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
  effectiveSampleLossDb,
} from "./material-library";

describe("custom material library (mandatory §3)", () => {
  it("creates a material with dB attenuation and version/audit stamps", () => {
    const m = createMaterial({
      name: "Custom Concrete",
      source: "Internal test data",
      attenuationSamples: [
        { technology: "WIFI", frequencyMHz: 2437, lossDb: 8 },
        { technology: "WIFI", frequencyMHz: 5500, lossDb: 12 },
        { technology: "BLE", frequencyMHz: 2440, lossDb: 8 },
      ],
    });
    expect(m.version).toBe(1);
    expect(m.createdAt).toBeTruthy();
    expect(m.attenuationSamples).toHaveLength(3);
  });

  it("rejects NaN and Infinity loss values", () => {
    const nan = validateMaterial({
      name: "X",
      attenuationSamples: [{ technology: "WIFI", frequencyMHz: 5500, lossDb: NaN }],
    });
    expect(nan.ok).toBe(false);
    expect(nan.issues.some((i) => i.code === "loss-not-finite")).toBe(true);
    const inf = validateMaterial({
      name: "X",
      attenuationSamples: [{ technology: "WIFI", frequencyMHz: 5500, lossDb: Infinity }],
    });
    expect(inf.ok).toBe(false);
  });

  it("rejects negative loss unless advanced override is set", () => {
    const bad = validateMaterial({
      name: "X",
      source: "s",
      attenuationSamples: [{ technology: "WIFI", frequencyMHz: 5500, lossDb: -3 }],
    });
    expect(bad.ok).toBe(false);
    const overridden = validateMaterial(
      {
        name: "X",
        source: "s",
        attenuationSamples: [{ technology: "WIFI", frequencyMHz: 5500, lossDb: -3 }],
      },
      { allowNegative: true },
    );
    expect(overridden.ok).toBe(true);
  });

  it("detects duplicate frequency samples for a technology", () => {
    const res = validateMaterial({
      name: "X",
      source: "s",
      attenuationSamples: [
        { technology: "WIFI", frequencyMHz: 5500, lossDb: 12 },
        { technology: "WIFI", frequencyMHz: 5500, lossDb: 13 },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "duplicate-sample")).toBe(true);
  });

  it("warns on unusually high loss and missing source", () => {
    const res = validateMaterial({
      name: "X",
      attenuationSamples: [{ technology: "WIFI", frequencyMHz: 5500, lossDb: 80 }],
    });
    expect(res.issues.some((i) => i.code === "loss-high")).toBe(true);
    expect(res.issues.some((i) => i.code === "no-source")).toBe(true);
  });

  it("requires a name", () => {
    expect(validateMaterial({ name: "" }).ok).toBe(false);
  });

  it("update bumps version and preserves id; duplicate makes a fresh id", () => {
    const m = createMaterial({ name: "Base", source: "s" });
    const u = updateMaterial(m, { name: "Base 2" });
    expect(u.id).toBe(m.id);
    expect(u.version).toBe(2);
    const dup = duplicateMaterial(m);
    expect(dup.id).not.toBe(m.id);
    expect(dup.name).toContain("copy");
  });

  it("archive and restore toggle the archived flag", () => {
    const m = createMaterial({ name: "A", source: "s" });
    expect(archiveMaterial(m).archived).toBe(true);
    expect(restoreMaterial(archiveMaterial(m)).archived).toBe(false);
  });

  it("search filters by query and hides archived by default", () => {
    const a = createMaterial({ name: "Brick wall", source: "s" });
    const b = archiveMaterial(createMaterial({ name: "Glass", source: "s" }));
    const list = [a, b];
    expect(searchMaterials(list, "brick")).toHaveLength(1);
    expect(searchMaterials(list, "")).toHaveLength(1); // archived hidden
    expect(searchMaterials(list, "", true)).toHaveLength(2);
  });

  it("export/import round-trips valid materials and skips invalid ones", () => {
    const m = createMaterial({ name: "Exported", source: "s" });
    const json = exportMaterialsJson([m]);
    const imported = importMaterialsJson(json);
    expect(imported.materials).toHaveLength(1);
    expect(imported.materials[0]!.name).toBe("Exported");

    const bad = importMaterialsJson(JSON.stringify({ materials: [{ id: "x", name: 5 }] }));
    expect(bad.materials).toHaveLength(0);
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it("effective sample loss uses nearest explicit sample, else legacy band", () => {
    const withSamples = createMaterial({
      name: "S",
      source: "s",
      attenuationSamples: [{ technology: "WIFI", frequencyMHz: 5500, lossDb: 14 }],
    });
    expect(effectiveSampleLossDb(withSamples, "WIFI", 5500)).toBe(14);
    const legacy = createMaterial({
      name: "L",
      source: "s",
      attenuationDb: { "2.4": 8, "5": 12, "6": 15 },
    });
    expect(effectiveSampleLossDb(legacy, "WIFI", 5500)).toBe(12);
    expect(effectiveSampleLossDb(legacy, "WIFI", 6500)).toBe(15);
  });
});
