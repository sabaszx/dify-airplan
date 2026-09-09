import { describe, it, expect } from "vitest";
import { resolveAttenuationDb, isThicknessDependent } from "./attenuation";
import { thicknessToMeters, metersToThickness, clampThicknessM } from "@/lib/thickness";
import type { WallMaterial } from "@/domain/model";

const base: WallMaterial = {
  id: "m",
  name: "Test",
  attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
  isDefault: true,
};

describe("thickness unit conversion (mandatory)", () => {
  it("converts mm/cm/in/ft to meters correctly", () => {
    expect(thicknessToMeters(100, "mm")).toBeCloseTo(0.1, 9);
    expect(thicknessToMeters(15, "cm")).toBeCloseTo(0.15, 9);
    expect(thicknessToMeters(12, "in")).toBeCloseTo(0.3048, 9);
    expect(thicknessToMeters(1, "ft")).toBeCloseTo(0.3048, 9);
  });
  it("round-trips meters<->display", () => {
    expect(metersToThickness(thicknessToMeters(200, "mm"), "mm")).toBeCloseTo(200, 6);
  });
  it("clamps to a sane physical range", () => {
    expect(clampThicknessM(0)).toBeGreaterThan(0);
    expect(clampThicknessM(99)).toBeLessThanOrEqual(2);
  });
});

describe("attenuation models (mandatory)", () => {
  it("fixed model returns a constant regardless of path length", () => {
    const mat: WallMaterial = {
      ...base,
      models: { "5": { kind: "fixed", fixedDb: 10, baseDb: 0, lossPerMeterDb: 0 } },
    };
    expect(resolveAttenuationDb(mat, "5", 0.1)).toBe(10);
    expect(resolveAttenuationDb(mat, "5", 0.5)).toBe(10); // thickness ignored
    expect(isThicknessDependent(mat, "5")).toBe(false);
  });

  it("per-thickness model scales with in-material path length", () => {
    const mat: WallMaterial = {
      ...base,
      models: { "5": { kind: "per-thickness", fixedDb: 0, baseDb: 0, lossPerMeterDb: 100 } },
    };
    expect(resolveAttenuationDb(mat, "5", 0.1)).toBeCloseTo(10, 6);
    expect(resolveAttenuationDb(mat, "5", 0.2)).toBeCloseTo(20, 6); // oblique/longer => more loss
    expect(isThicknessDependent(mat, "5")).toBe(true);
  });

  it("base-plus-thickness adds a base loss", () => {
    const mat: WallMaterial = {
      ...base,
      models: { "6": { kind: "base-plus-thickness", fixedDb: 0, baseDb: 3, lossPerMeterDb: 50 } },
    };
    expect(resolveAttenuationDb(mat, "6", 0.1)).toBeCloseTo(8, 6); // 3 + 5
  });

  it("falls back to legacy fixed per-band value when no model", () => {
    expect(resolveAttenuationDb(base, "2.4", 0.3)).toBe(12);
    expect(resolveAttenuationDb(base, "5", 0.3)).toBe(15);
  });

  it("BLE/UWB with no model approximate from nearest Wi-Fi band (labeled default)", () => {
    expect(resolveAttenuationDb(base, "ble", 0.1)).toBe(12); // ~2.4 GHz
    expect(resolveAttenuationDb(base, "uwb", 0.1)).toBe(17); // ~6 GHz high band
  });

  it("a thick wall does not necessarily lose more than a thin wall of another material", () => {
    const thickLight: WallMaterial = {
      ...base,
      id: "light",
      models: { "5": { kind: "per-thickness", fixedDb: 0, baseDb: 0, lossPerMeterDb: 10 } },
    };
    const thinHeavy: WallMaterial = {
      ...base,
      id: "heavy",
      models: { "5": { kind: "fixed", fixedDb: 25, baseDb: 0, lossPerMeterDb: 0 } },
    };
    const thickLoss = resolveAttenuationDb(thickLight, "5", 0.3); // 3 dB
    const thinLoss = resolveAttenuationDb(thinHeavy, "5", 0.05); // 25 dB
    expect(thinLoss).toBeGreaterThan(thickLoss);
  });
});
