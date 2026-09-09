import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  fspl,
  logDistancePathLoss,
  PATH_LOSS_EXPONENT,
  BAND_CENTER_MHZ,
  type Band,
} from "./pathloss";
import { signalFromRadio, DEFAULT_ENGINE_CONFIG, type ApInput, type WallInput } from "./engine";
import { interpolateCut } from "@/antenna/gain";
import { getDomain, allowedChannels } from "@/regulatory/domains";
import { planChannels } from "./channel";

// Deterministic seed for reproducible property runs.
const cfg = { seed: 1234, numRuns: 120 } as const;

describe("RF invariants (property-based)", () => {
  it("increasing distance cannot increase free-space received power (all else equal)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 50, noNaN: true }),
        fc.double({ min: 0.1, max: 50, noNaN: true }),
        fc.constantFrom<Band>("2.4", "5", "6"),
        (d1, extra, band) => {
          const d2 = d1 + extra; // strictly farther
          const f = BAND_CENTER_MHZ[band];
          // Received power ∝ -FSPL; farther => higher loss => lower power.
          expect(fspl(d2, f)).toBeGreaterThanOrEqual(fspl(d1, f) - 1e-9);
        },
      ),
      cfg,
    );
  });

  it("adding a positive-attenuation wall cannot increase received signal", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3, max: 30, noNaN: true }),
        fc.double({ min: 1, max: 30, noNaN: true }),
        (dx, att) => {
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
          const target = { x: dx, y: 0 };
          const noWall = signalFromRadio(ap, radio, target, [], DEFAULT_ENGINE_CONFIG);
          const wall: WallInput = {
            polyline: [
              { x: dx / 2, y: -5 },
              { x: dx / 2, y: 5 },
            ],
            attenuationDb: { "2.4": att, "5": att, "6": att },
            thicknessM: 0.1,
          };
          const withWall = signalFromRadio(ap, radio, target, [wall], DEFAULT_ENGINE_CONFIG);
          expect(withWall).toBeLessThanOrEqual(noWall + 1e-9);
        },
      ),
      cfg,
    );
  });

  it("log-distance path loss is monotonic non-decreasing in distance", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (d, extra) => {
          const n = PATH_LOSS_EXPONENT.office;
          const f = 5500;
          expect(logDistancePathLoss(d + extra, f, n)).toBeGreaterThanOrEqual(
            logDistancePathLoss(d, f, n) - 1e-9,
          );
        },
      ),
      cfg,
    );
  });

  it("circular interpolation is continuous around 0/360 degrees", () => {
    const samples = [
      { angleDeg: 0, gainDbi: 10 },
      { angleDeg: 90, gainDbi: 2 },
      { angleDeg: 180, gainDbi: -8 },
      { angleDeg: 270, gainDbi: 2 },
    ];
    fc.assert(
      fc.property(fc.double({ min: 0, max: 360, noNaN: true }), (a) => {
        const g1 = interpolateCut(samples, a);
        const g2 = interpolateCut(samples, a + 360); // wrap
        expect(Math.abs(g1 - g2)).toBeLessThan(1e-6);
      }),
      cfg,
    );
  });

  it("interpolating exactly at 0 and 360 gives the same value", () => {
    const samples = [
      { angleDeg: 0, gainDbi: 7 },
      { angleDeg: 120, gainDbi: 1 },
      { angleDeg: 240, gainDbi: 1 },
    ];
    expect(interpolateCut(samples, 0)).toBeCloseTo(interpolateCut(samples, 360), 6);
  });

  it("the channel planner never assigns a channel outside the regulatory allow-list", () => {
    const domain = getDomain("US");
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(
          fc.record({
            x: fc.double({ min: 0, max: 60, noNaN: true }),
            y: fc.double({ min: 0, max: 60, noNaN: true }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (allowDfs, positions) => {
          const allowed = allowedChannels(domain, "5", allowDfs);
          const allowedSet = new Set(allowed.map((c) => c.channel));
          const aps: ApInput[] = positions.map((p, i) => ({
            id: `ap${i}`,
            position: p,
            mountingHeightM: 3,
            radios: [
              {
                band: "5",
                enabled: true,
                txPowerDbm: 15,
                channel: 0,
                channelWidthMHz: 40,
                spatialStreams: 2,
                antenna: { gainDbi: 4, omnidirectional: true },
              },
            ],
          }));
          const assignments = planChannels("5", aps, allowed);
          for (const a of assignments) expect(allowedSet.has(a.channel)).toBe(true);
        },
      ),
      cfg,
    );
  });
});
