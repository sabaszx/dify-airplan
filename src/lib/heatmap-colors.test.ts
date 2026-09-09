import { describe, it, expect } from "vitest";
import {
  colorFor,
  gradientLegendFor,
  paletteGradientCss,
  setPalette,
  getPalette,
} from "./heatmap-colors";
import type { PointResult } from "@/rf/engine";

function pt(rssi: number): PointResult {
  return {
    rssiDbm: rssi,
    bestApId: "ap1",
    secondaryRssiDbm: -Infinity,
    secondaryApId: null,
    noiseFloorDbm: -92,
    snrDb: rssi + 92,
    sinrDb: rssi + 92,
    coChannelDbm: -Infinity,
    adjChannelDbm: -Infinity,
    audibleApCount: 1,
    phyRateMbps: 300,
    usableThroughputMbps: 150,
    mcsLabel: "MCS7",
    estimatedClientCapacity: 20,
  };
}

describe("heatmap palette", () => {
  it("returns a color for a valid RSSI cell", () => {
    setPalette("coverage");
    const c = colorFor("rssi", pt(-60));
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("strong and weak signals map to different colors", () => {
    setPalette("coverage");
    expect(colorFor("rssi", pt(-45))).not.toBe(colorFor("rssi", pt(-88)));
  });

  it("respects the active palette toggle", () => {
    setPalette("accessible");
    expect(getPalette()).toBe("accessible");
    setPalette("coverage");
    expect(getPalette()).toBe("coverage");
  });

  it("gradient legend gives a CSS gradient and labeled bounds for RSSI", () => {
    const g = gradientLegendFor("rssi");
    expect(g).not.toBeNull();
    expect(g!.gradientCss).toContain("linear-gradient");
    expect(g!.minLabel).toContain("dBm");
    expect(g!.highCaption).toBe("Great signal");
  });

  it("paletteGradientCss returns a linear gradient string", () => {
    expect(paletteGradientCss("coverage")).toContain("linear-gradient");
  });
});
