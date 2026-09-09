import { describe, it, expect } from "vitest";
import { validatePattern, buildPattern, parseCsvCut, parseCombinedCsv, parseMsi } from "./import";
import { interpolateCut, gainFromPattern, fallbackGain } from "./gain";
import type { AntennaPattern } from "./schema";

const samplePattern: AntennaPattern = {
  schemaVersion: "1.0",
  id: "test",
  revision: 0,
  manufacturer: "Cisco",
  model: "Sample Sector",
  antenna: {
    name: "Sector",
    type: "sector",
    internal: false,
    polarization: "dual",
    coordinateSystem: "spherical",
    orientation: { forwardAxis: "+Y", upAxis: "+Z" },
    downtiltDeg: 0,
  },
  patterns: [
    {
      frequencyMHz: 5500,
      peakGainDbi: 10,
      // Main lobe toward 0°, nulls toward 180°.
      azimuth: [
        { angleDeg: 0, gainDbi: 10 },
        { angleDeg: 45, gainDbi: 6 },
        { angleDeg: 90, gainDbi: 0 },
        { angleDeg: 135, gainDbi: -6 },
        { angleDeg: 180, gainDbi: -15 },
        { angleDeg: 225, gainDbi: -6 },
        { angleDeg: 270, gainDbi: 0 },
        { angleDeg: 315, gainDbi: 6 },
      ],
      elevation: [
        { angleDeg: -90, gainDbi: -10 },
        { angleDeg: 0, gainDbi: 10 },
        { angleDeg: 90, gainDbi: -10 },
      ],
    },
  ],
  source: { type: "sample", lastVerified: null },
  verificationStatus: "sample",
};

describe("interpolateCut (circular)", () => {
  it("returns exact sample values at sample angles", () => {
    expect(interpolateCut(samplePattern.patterns[0]!.azimuth, 0)).toBeCloseTo(10, 6);
    expect(interpolateCut(samplePattern.patterns[0]!.azimuth, 180)).toBeCloseTo(-15, 6);
  });
  it("interpolates between samples", () => {
    const g = interpolateCut(samplePattern.patterns[0]!.azimuth, 22.5);
    expect(g).toBeGreaterThan(6);
    expect(g).toBeLessThan(10);
  });
  it("wraps across 0/360", () => {
    // 350° lies between 315 (6) and 0/360 (10)
    const g = interpolateCut(samplePattern.patterns[0]!.azimuth, 350);
    expect(g).toBeGreaterThan(6);
    expect(g).toBeLessThan(10);
  });
});

describe("gainFromPattern (directional applied, mandatory)", () => {
  it("boresight gain exceeds back-lobe gain", () => {
    const front = gainFromPattern(samplePattern, {
      azimuthDeg: 0,
      elevationDeg: 0,
      frequencyMHz: 5500,
    });
    const back = gainFromPattern(samplePattern, {
      azimuthDeg: 180,
      elevationDeg: 0,
      frequencyMHz: 5500,
    });
    expect(front.gainDbi).toBeGreaterThan(back.gainDbi);
    expect(front.method).toBe("pattern");
    expect(front.patternRevision).toBe(0);
  });
  it("selects the frequency pattern nearest the query", () => {
    const r = gainFromPattern(samplePattern, {
      azimuthDeg: 0,
      elevationDeg: 0,
      frequencyMHz: 2400,
    });
    expect(r.gainDbi).toBeGreaterThan(0); // only 5500 exists, still used
  });
});

describe("fallbackGain (never silently omni)", () => {
  it("has a clear directional main lobe and is labeled as fallback", () => {
    const front = fallbackGain(8, 60, 25, { azimuthDeg: 0, elevationDeg: 0, frequencyMHz: 5500 });
    const back = fallbackGain(8, 60, 25, { azimuthDeg: 180, elevationDeg: 0, frequencyMHz: 5500 });
    expect(front.gainDbi).toBeGreaterThan(back.gainDbi);
    expect(front.method).toBe("fallback-cosine");
  });
});

describe("pattern validation (mandatory: invalid data => actionable errors)", () => {
  it("accepts a valid sample pattern", () => {
    const res = validatePattern(samplePattern);
    expect(res.ok).toBe(true);
    expect(res.issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("rejects a pattern with a duplicate azimuth angle", () => {
    const bad = JSON.parse(JSON.stringify(samplePattern));
    bad.patterns[0].azimuth.push({ angleDeg: 0, gainDbi: 5 });
    const res = validatePattern(bad);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "azimuth-duplicate-angle")).toBe(true);
  });

  it("rejects a structurally invalid pattern with a schema error", () => {
    const res = validatePattern({ schemaVersion: "1.0", model: 123 });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "schema")).toBe(true);
    expect(res.pattern).toBeNull();
  });

  it("warns on unrealistic gain", () => {
    const bad = JSON.parse(JSON.stringify(samplePattern));
    bad.patterns[0].peakGainDbi = 99;
    const res = validatePattern(bad);
    expect(res.issues.some((i) => i.code === "gain-unrealistic")).toBe(true);
  });
});

describe("CSV / MSI parsing", () => {
  it("parses a single-cut CSV", () => {
    const rows = parseCsvCut("angle,gain\n0,10\n90,3\n180,-12");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ angleDeg: 0, gainDbi: 10 });
  });

  it("parses a combined CSV into az/el cuts", () => {
    const csv = "5500,az,0,10\n5500,az,90,2\n5500,el,0,10\n5500,el,90,-8";
    const parsed = parseCombinedCsv(csv);
    expect(parsed?.azimuth).toHaveLength(2);
    expect(parsed?.elevation).toHaveLength(2);
  });

  it("buildPattern validates parsed cuts", () => {
    const res = buildPattern(
      {
        manufacturer: "ACME",
        model: "Custom Patch",
        antennaName: "Patch",
        antennaType: "patch",
        frequencyMHz: 5500,
        peakGainDbi: 8,
      },
      [
        { angleDeg: 0, gainDbi: 8 },
        { angleDeg: 90, gainDbi: 2 },
        { angleDeg: 180, gainDbi: -10 },
        { angleDeg: 270, gainDbi: 2 },
      ],
      [
        { angleDeg: -90, gainDbi: -8 },
        { angleDeg: 0, gainDbi: 8 },
        { angleDeg: 90, gainDbi: -8 },
      ],
    );
    expect(res.pattern).not.toBeNull();
  });

  it("parses a minimal MSI file (loss -> dBi)", () => {
    const msi = [
      "NAME Test",
      "FREQUENCY 5500",
      "GAIN 10 dBi",
      "HORIZONTAL 4",
      "0 0",
      "90 10",
      "180 25",
      "270 10",
    ].join("\n");
    const parsed = parseMsi(msi);
    expect(parsed?.peakGainDbi).toBe(10);
    expect(parsed?.azimuth[0]).toEqual({ angleDeg: 0, gainDbi: 10 }); // 10 - 0 loss
    expect(parsed?.azimuth[2]).toEqual({ angleDeg: 180, gainDbi: -15 }); // 10 - 25 loss
  });
});
