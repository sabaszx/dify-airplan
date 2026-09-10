import { describe, it, expect } from "vitest";
import {
  DEFAULT_LAYER_VISIBILITY,
  showsDevices,
  showsAnalysis,
  visibleTechnologies,
  cycleState,
  TECH_GLYPH,
  type LayerVisibility,
} from "./layer-visibility";

describe("layer visibility (mandatory §5)", () => {
  it("Wi-Fi/BLE/UWB have independent states", () => {
    const v: LayerVisibility = { WIFI: "devices-and-analysis", BLE: "hidden", UWB: "devices" };
    expect(showsDevices(v, "WIFI")).toBe(true);
    expect(showsDevices(v, "BLE")).toBe(false);
    expect(showsDevices(v, "UWB")).toBe(true);
    expect(showsAnalysis(v, "WIFI")).toBe(true);
    expect(showsAnalysis(v, "UWB")).toBe(false); // devices only, no analysis
  });

  it("devices-only shows icons but not analysis", () => {
    const v: LayerVisibility = { ...DEFAULT_LAYER_VISIBILITY, WIFI: "devices" };
    expect(showsDevices(v, "WIFI")).toBe(true);
    expect(showsAnalysis(v, "WIFI")).toBe(false);
  });

  it("analysis-only shows overlay but not device icons", () => {
    const v: LayerVisibility = { ...DEFAULT_LAYER_VISIBILITY, WIFI: "analysis-only" };
    expect(showsDevices(v, "WIFI")).toBe(false);
    expect(showsAnalysis(v, "WIFI")).toBe(true);
  });

  it("hidden shows neither", () => {
    const v: LayerVisibility = { WIFI: "hidden", BLE: "hidden", UWB: "hidden" };
    expect(showsDevices(v, "WIFI")).toBe(false);
    expect(showsAnalysis(v, "WIFI")).toBe(false);
    expect(visibleTechnologies(v)).toEqual([]);
  });

  it("legend lists only visible technologies", () => {
    const v: LayerVisibility = { WIFI: "hidden", BLE: "devices", UWB: "devices-and-analysis" };
    expect(visibleTechnologies(v)).toEqual(["BLE", "UWB"]);
  });

  it("cycle rotates hidden -> devices -> devices+analysis -> hidden", () => {
    expect(cycleState("hidden")).toBe("devices");
    expect(cycleState("devices")).toBe("devices-and-analysis");
    expect(cycleState("devices-and-analysis")).toBe("hidden");
  });

  it("each technology has a distinct accessible symbol + label (not color-only)", () => {
    const symbols = new Set([TECH_GLYPH.WIFI.symbol, TECH_GLYPH.BLE.symbol, TECH_GLYPH.UWB.symbol]);
    expect(symbols.size).toBe(3);
    expect(TECH_GLYPH.UWB.label).toContain("anchor");
  });
});
