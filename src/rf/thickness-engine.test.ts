import { describe, it, expect } from "vitest";
import { signalFromRadio, DEFAULT_ENGINE_CONFIG, type ApInput, type WallInput } from "./engine";
import type { WallMaterial } from "@/domain/model";

const ap: ApInput = {
  id: "a",
  position: { x: 0, y: 0 },
  mountingHeightM: 3,
  radios: [
    {
      band: "5",
      enabled: true,
      txPowerDbm: 15,
      channel: 36,
      channelWidthMHz: 40,
      spatialStreams: 2,
      antenna: { gainDbi: 4, omnidirectional: true },
    },
  ],
};
const radio = ap.radios[0]!;

function tallWall(material: WallMaterial, thicknessM: number): WallInput {
  return {
    polyline: [
      { x: 5, y: -50 },
      { x: 5, y: 50 },
    ],
    attenuationDb: material.attenuationDb,
    thicknessM,
    material,
    alignment: "center",
  };
}

describe("thickness-aware engine (mandatory)", () => {
  it("fixed-loss material is counted once per crossing regardless of thickness", () => {
    const mat: WallMaterial = {
      id: "fixed",
      name: "Fixed",
      attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
      models: { "5": { kind: "fixed", fixedDb: 15, baseDb: 0, lossPerMeterDb: 0 } },
      isDefault: true,
    };
    const thin = signalFromRadio(
      ap,
      radio,
      { x: 10, y: 0 },
      [tallWall(mat, 0.1)],
      DEFAULT_ENGINE_CONFIG,
    );
    const thick = signalFromRadio(
      ap,
      radio,
      { x: 10, y: 0 },
      [tallWall(mat, 0.4)],
      DEFAULT_ENGINE_CONFIG,
    );
    // Same fixed loss => identical RSSI regardless of physical thickness.
    expect(thick).toBeCloseTo(thin, 6);
  });

  it("per-thickness material loses more through a thicker wall", () => {
    const mat: WallMaterial = {
      id: "pt",
      name: "PerThickness",
      attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
      models: { "5": { kind: "per-thickness", fixedDb: 0, baseDb: 0, lossPerMeterDb: 100 } },
      isDefault: true,
    };
    const thin = signalFromRadio(
      ap,
      radio,
      { x: 10, y: 0 },
      [tallWall(mat, 0.1)],
      DEFAULT_ENGINE_CONFIG,
    );
    const thick = signalFromRadio(
      ap,
      radio,
      { x: 10, y: 0 },
      [tallWall(mat, 0.3)],
      DEFAULT_ENGINE_CONFIG,
    );
    // Thicker wall => more in-material length => lower RSSI. ~ (0.3-0.1)*100 = 20 dB.
    expect(thin - thick).toBeCloseTo(20, 0);
  });

  it("oblique traversal loses more than perpendicular for a per-thickness material", () => {
    const mat: WallMaterial = {
      id: "pt2",
      name: "PerThickness",
      attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
      models: { "5": { kind: "per-thickness", fixedDb: 0, baseDb: 0, lossPerMeterDb: 100 } },
      isDefault: true,
    };
    const wall = tallWall(mat, 0.2);
    const perp = signalFromRadio(ap, radio, { x: 10, y: 0 }, [wall], DEFAULT_ENGINE_CONFIG);
    const oblique = signalFromRadio(ap, radio, { x: 10, y: 10 }, [wall], DEFAULT_ENGINE_CONFIG);
    // Isolate wall effect: compare against the same geometry with no wall.
    const perpNo = signalFromRadio(ap, radio, { x: 10, y: 0 }, [], DEFAULT_ENGINE_CONFIG);
    const obliqueNo = signalFromRadio(ap, radio, { x: 10, y: 10 }, [], DEFAULT_ENGINE_CONFIG);
    const perpWallLoss = perpNo - perp;
    const obliqueWallLoss = obliqueNo - oblique;
    expect(obliqueWallLoss).toBeGreaterThan(perpWallLoss);
  });
});
