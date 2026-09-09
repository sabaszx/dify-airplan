import { describe, it, expect } from "vitest";
import { signalFromRadio, DEFAULT_ENGINE_CONFIG, type ApInput, type WallInput } from "./engine";
import { wallPieces } from "@/editor/wall-editing";
import type { Wall } from "@/domain/model";

const ap: ApInput = {
  id: "ap1",
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
const target = { x: 10, y: 0 };
const material = { "2.4": 12, "5": 15, "6": 17 };

function solidWall(): WallInput {
  return {
    polyline: [
      { x: 5, y: -5 },
      { x: 5, y: 5 },
    ],
    attenuationDb: material,
    thicknessM: 0.15,
  };
}

describe("opening reduces attenuation along the path (mandatory concept)", () => {
  it("a door opening on the crossing point lowers loss vs a solid wall", () => {
    const solid = signalFromRadio(ap, radio, target, [solidWall()], DEFAULT_ENGINE_CONFIG);

    // Wall with a door centered where the AP->target path crosses (y=0, t=0.5).
    const wall: Wall = {
      id: "w1",
      polyline: [
        { x: 5, y: -5 },
        { x: 5, y: 5 },
      ],
      materialId: "concrete",
      thicknessM: 0.15,
      heightM: 2.7,
      bottomElevationM: 0,
      openings: [
        {
          id: "o1",
          type: "door",
          segmentIndex: 0,
          t: 0.5, // center of the 10 m segment => world y=0
          widthM: 2,
          heightM: 2.1,
          bottomElevationM: 0,
          open: true,
          attenuationDb: { "2.4": 1, "5": 1, "6": 1 },
        },
      ],
    };
    const pieces = wallPieces(wall, material);
    const withOpening: WallInput = {
      polyline: wall.polyline,
      attenuationDb: material,
      thicknessM: wall.thicknessM,
      pieces,
    };
    const opened = signalFromRadio(ap, radio, target, [withOpening], DEFAULT_ENGINE_CONFIG);

    // Passing through the opening (1 dB) is stronger than through concrete (15 dB).
    expect(opened).toBeGreaterThan(solid);
  });
});
