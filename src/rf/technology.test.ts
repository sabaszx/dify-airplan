import { describe, it, expect } from "vitest";
import { getTechnologyProfile, resolveTechFreqMHz, TECHNOLOGY_PROFILES } from "./technology";
import { isPatternCompatible, CROSS_TECH_FALLBACK_WARNING } from "@/antenna/compatibility";
import type { AntennaPattern } from "@/antenna/schema";

function pattern(freqMHz: number): AntennaPattern {
  return {
    schemaVersion: "1.0",
    id: "p",
    revision: 1,
    manufacturer: "Cisco",
    model: "M",
    antenna: {
      name: "A",
      type: "omnidirectional",
      internal: true,
      polarization: "dual",
      coordinateSystem: "spherical",
      orientation: { forwardAxis: "+Y", upAxis: "+Z" },
      downtiltDeg: 0,
    },
    patterns: [
      {
        frequencyMHz: freqMHz,
        peakGainDbi: 4,
        azimuth: [
          { angleDeg: 0, gainDbi: 4 },
          { angleDeg: 180, gainDbi: 4 },
        ],
        elevation: [
          { angleDeg: -90, gainDbi: -6 },
          { angleDeg: 0, gainDbi: 4 },
          { angleDeg: 90, gainDbi: -6 },
        ],
      },
    ],
    source: { type: "sample", lastVerified: null },
    verificationStatus: "sample",
  };
}

describe("technology profiles", () => {
  it("defines WIFI/BLE/UWB with distinct attenuation keys and frequencies", () => {
    expect(getTechnologyProfile("WIFI").attenuationKey).toBe("5");
    expect(getTechnologyProfile("BLE").attenuationKey).toBe("ble");
    expect(getTechnologyProfile("UWB").attenuationKey).toBe("uwb");
    expect(TECHNOLOGY_PROFILES.BLE.defaultCenterMHz).toBeGreaterThan(2400);
    expect(TECHNOLOGY_PROFILES.UWB.defaultCenterMHz).toBeGreaterThan(6000);
  });

  it("resolves a channel center frequency", () => {
    expect(resolveTechFreqMHz("BLE", "adv-37")).toBe(2402);
    expect(resolveTechFreqMHz("UWB", "ch9")).toBeCloseTo(7987.2, 1);
    expect(resolveTechFreqMHz("WIFI")).toBe(5500);
  });

  it("UWB notes disclaim guaranteed accuracy", () => {
    expect(TECHNOLOGY_PROFILES.UWB.notes.toLowerCase()).toContain("does not imply centimeter");
  });
});

describe("pattern compatibility (mandatory: no silent Wi-Fi reuse)", () => {
  it("a 5 GHz Wi-Fi pattern is NOT compatible with BLE (2.4 GHz)", () => {
    const res = isPatternCompatible(pattern(5500), "BLE");
    expect(res.compatible).toBe(false);
    expect(res.useFallback).toBe(true);
  });

  it("a 5 GHz Wi-Fi pattern is NOT compatible with UWB (~6.5 GHz)", () => {
    const res = isPatternCompatible(pattern(5500), "UWB");
    expect(res.compatible).toBe(false);
  });

  it("a 2.44 GHz pattern IS compatible with BLE", () => {
    const res = isPatternCompatible(pattern(2440), "BLE");
    expect(res.compatible).toBe(true);
    expect(res.useFallback).toBe(false);
  });

  it("a 6.5 GHz pattern IS compatible with UWB channel 5", () => {
    const res = isPatternCompatible(pattern(6490), "UWB", "ch5");
    expect(res.compatible).toBe(true);
  });

  it("exposes a labeled fallback warning", () => {
    expect(CROSS_TECH_FALLBACK_WARNING.toLowerCase()).toContain("generic fallback");
  });
});
