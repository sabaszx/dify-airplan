import { describe, it, expect } from "vitest";
import { signalFromRadio, DEFAULT_ENGINE_CONFIG, type ApInput, type RadioInput } from "./engine";
import type { AntennaPattern } from "@/antenna/schema";

const sector: AntennaPattern = {
  schemaVersion: "1.0",
  id: "sector-5g",
  revision: 3,
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
      peakGainDbi: 12,
      azimuth: [
        { angleDeg: 0, gainDbi: 12 },
        { angleDeg: 90, gainDbi: 0 },
        { angleDeg: 180, gainDbi: -18 },
        { angleDeg: 270, gainDbi: 0 },
      ],
      elevation: [
        { angleDeg: -90, gainDbi: -10 },
        { angleDeg: 0, gainDbi: 12 },
        { angleDeg: 90, gainDbi: -10 },
      ],
    },
  ],
  source: { type: "sample", lastVerified: null },
  verificationStatus: "sample",
};

function apWithPattern(boresightDeg: number): { ap: ApInput; radio: RadioInput } {
  const radio: RadioInput = {
    band: "5",
    enabled: true,
    txPowerDbm: 15,
    channel: 100,
    channelCenterMHz: 5500,
    channelWidthMHz: 40,
    spatialStreams: 2,
    antenna: {
      gainDbi: 12,
      omnidirectional: false,
      boresightDeg,
      beamwidthDeg: 90,
      frontToBackDb: 30,
    },
    pattern: sector,
  };
  const ap: ApInput = { id: "ap1", position: { x: 0, y: 0 }, mountingHeightM: 3, radios: [radio] };
  return { ap, radio };
}

describe("pattern-driven directional gain in the engine (mandatory)", () => {
  it("rotating a directional AP changes the prediction at a fixed point", () => {
    const target = { x: 10, y: 0 }; // due +X (azimuth 0)
    const facingTarget = apWithPattern(0);
    const facingAway = apWithPattern(180);

    const rssiToward = signalFromRadio(
      facingTarget.ap,
      facingTarget.radio,
      target,
      [],
      DEFAULT_ENGINE_CONFIG,
    );
    const rssiAway = signalFromRadio(
      facingAway.ap,
      facingAway.radio,
      target,
      [],
      DEFAULT_ENGINE_CONFIG,
    );

    expect(rssiToward).toBeGreaterThan(rssiAway);
    // The difference should be substantial (front vs back lobe).
    expect(rssiToward - rssiAway).toBeGreaterThan(10);
  });

  it("is deterministic for identical inputs", () => {
    const { ap, radio } = apWithPattern(0);
    const t = { x: 7, y: 3 };
    expect(signalFromRadio(ap, radio, t, [], DEFAULT_ENGINE_CONFIG)).toBe(
      signalFromRadio(ap, radio, t, [], DEFAULT_ENGINE_CONFIG),
    );
  });
});
