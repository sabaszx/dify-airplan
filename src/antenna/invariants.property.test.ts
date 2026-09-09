import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { gainFromPattern } from "./gain";
import type { AntennaPattern } from "./schema";

const cfg = { seed: 777, numRuns: 100 } as const;

function omni(peak: number): AntennaPattern {
  return {
    schemaVersion: "1.0",
    id: "omni",
    revision: 1,
    manufacturer: "Cisco",
    model: "Omni",
    antenna: {
      name: "Omni",
      type: "omnidirectional",
      internal: true,
      polarization: "dual",
      coordinateSystem: "spherical",
      orientation: { forwardAxis: "+Y", upAxis: "+Z" },
      downtiltDeg: 0,
    },
    patterns: [
      {
        frequencyMHz: 5500,
        peakGainDbi: peak,
        // Uniform azimuth = omnidirectional.
        azimuth: Array.from({ length: 12 }, (_, i) => ({ angleDeg: i * 30, gainDbi: peak })),
        elevation: [
          { angleDeg: -90, gainDbi: peak - 10 },
          { angleDeg: 0, gainDbi: peak },
          { angleDeg: 90, gainDbi: peak - 10 },
        ],
      },
    ],
    source: { type: "sample", lastVerified: null },
    verificationStatus: "sample",
  };
}

describe("Antenna invariants (property-based)", () => {
  it("rotating an omnidirectional pattern does not materially change azimuth gain", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -6, max: 12, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true }),
        (peak, az, rot) => {
          const p = omni(peak);
          // At the horizon (elevation 0), an omni's gain is peak regardless of az/rotation.
          const g1 = gainFromPattern(p, { azimuthDeg: az, elevationDeg: 0, frequencyMHz: 5500 });
          const g2 = gainFromPattern(p, {
            azimuthDeg: az - rot,
            elevationDeg: 0,
            frequencyMHz: 5500,
          });
          expect(Math.abs(g1.gainDbi - g2.gainDbi)).toBeLessThan(1e-6);
        },
      ),
      cfg,
    );
  });
});
