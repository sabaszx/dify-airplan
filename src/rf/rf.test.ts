import { describe, it, expect } from "vitest";
import { fspl, logDistancePathLoss, PATH_LOSS_EXPONENT, BAND_CENTER_MHZ } from "./pathloss";
import { effectiveGain } from "./antenna";
import { computePoint, signalFromRadio, type ApInput, type WallInput } from "./engine";
import { metersPerPixel } from "@/lib/units";
import { segmentsIntersect } from "./geometry";

const omni = (gain = 4) => ({ gainDbi: gain, omnidirectional: true });

function makeAp(id: string, x: number, y: number, overrides: Partial<ApInput> = {}): ApInput {
  return {
    id,
    position: { x, y },
    mountingHeightM: 3,
    radios: [
      {
        band: "5",
        enabled: true,
        txPowerDbm: 15,
        channel: 36,
        channelWidthMHz: 40,
        spatialStreams: 2,
        antenna: omni(),
      },
    ],
    ...overrides,
  };
}

describe("scale calibration (mandatory test)", () => {
  it("converts canvas distance to meters correctly", () => {
    // 200 px line declared as 10 m => 0.05 m/px
    expect(metersPerPixel(200, 10, "m")).toBeCloseTo(0.05, 6);
    // 200 px declared as 32.8084 ft (~10 m)
    expect(metersPerPixel(200, 32.808399, "ft")).toBeCloseTo(0.05, 5);
  });
});

describe("geometry", () => {
  it("detects crossing segments", () => {
    expect(
      segmentsIntersect(
        { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
        { a: { x: 5, y: -5 }, b: { x: 5, y: 5 } },
      ),
    ).toBe(true);
  });
  it("rejects non-crossing segments", () => {
    expect(
      segmentsIntersect(
        { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
        { a: { x: 0, y: 5 }, b: { x: 10, y: 5 } },
      ),
    ).toBe(false);
  });
});

describe("path loss frequency behavior (mandatory test)", () => {
  it("higher frequency yields higher path loss, all else equal", () => {
    const d = 10;
    const n = PATH_LOSS_EXPONENT.office;
    const pl24 = logDistancePathLoss(d, BAND_CENTER_MHZ["2.4"], n);
    const pl5 = logDistancePathLoss(d, BAND_CENTER_MHZ["5"], n);
    const pl6 = logDistancePathLoss(d, BAND_CENTER_MHZ["6"], n);
    expect(pl5).toBeGreaterThan(pl24);
    expect(pl6).toBeGreaterThan(pl5);
    // The delta equals 20*log10(f2/f1) since only PL(d0) changes.
    const expectedDelta = 20 * Math.log10(BAND_CENTER_MHZ["5"] / BAND_CENTER_MHZ["2.4"]);
    expect(pl5 - pl24).toBeCloseTo(expectedDelta, 6);
  });

  it("fspl increases 6 dB per distance doubling", () => {
    const f = 5500;
    expect(fspl(20, f) - fspl(10, f)).toBeCloseTo(6.0206, 3);
  });
});

describe("antenna directionality (mandatory test)", () => {
  const dir = {
    gainDbi: 8,
    omnidirectional: false,
    boresightDeg: 0,
    beamwidthDeg: 60,
    frontToBackDb: 25,
  };
  it("boresight has higher gain than behind", () => {
    expect(effectiveGain(dir, 0)).toBeGreaterThan(effectiveGain(dir, 180));
  });
  it("rotating 180 degrees swaps main lobe", () => {
    const rotated = { ...dir, boresightDeg: 180 };
    expect(effectiveGain(rotated, 180)).toBeGreaterThan(effectiveGain(rotated, 0));
  });
  it("peak gain at boresight equals configured gain", () => {
    expect(effectiveGain(dir, 0)).toBeCloseTo(8, 6);
  });
});

describe("wall attenuation (mandatory test)", () => {
  it("adding a concrete wall reduces signal behind it", () => {
    const ap = makeAp("ap1", 0, 0);
    const radio = ap.radios[0]!;
    const target = { x: 10, y: 0 };
    const noWall = signalFromRadio(ap, radio, target, [], {
      environment: "office",
      noiseFloorDbm: { "2.4": -95, "5": -92, "6": -92 },
      clientHeightM: 1,
      clientGainDbi: 0,
      adjacentRejectionDb: 20,
      audibleThresholdDbm: -85,
      requiredThroughputPerClientMbps: 5,
      efficiencyFactor: 0.5,
    });
    const wall: WallInput = {
      polyline: [
        { x: 5, y: -5 },
        { x: 5, y: 5 },
      ],
      attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
      thicknessM: 0.2,
    };
    const withWall = signalFromRadio(ap, radio, target, [wall], {
      environment: "office",
      noiseFloorDbm: { "2.4": -95, "5": -92, "6": -92 },
      clientHeightM: 1,
      clientGainDbi: 0,
      adjacentRejectionDb: 20,
      audibleThresholdDbm: -85,
      requiredThroughputPerClientMbps: 5,
      efficiencyFactor: 0.5,
    });
    expect(withWall).toBeLessThan(noWall);
  });
});

describe("disabled radios excluded (mandatory test)", () => {
  it("a disabled band produces no serving AP", () => {
    const ap = makeAp("ap1", 0, 0, {
      radios: [
        {
          band: "6",
          enabled: false,
          txPowerDbm: 15,
          channel: 37,
          channelWidthMHz: 80,
          spatialStreams: 2,
          antenna: omni(),
        },
      ],
    });
    const res = computePoint({ x: 3, y: 0 }, "6", [ap], []);
    expect(res.bestApId).toBeNull();
    expect(res.rssiDbm).toBe(-Infinity);
  });
});

describe("determinism (mandatory test)", () => {
  it("identical inputs produce identical outputs", () => {
    const aps = [makeAp("ap1", 0, 0), makeAp("ap2", 20, 0)];
    const target = { x: 10, y: 2 };
    const a = computePoint(target, "5", aps, []);
    const b = computePoint(target, "5", aps, []);
    expect(a).toEqual(b);
  });

  it("SNR = RSSI - noise floor", () => {
    const ap = makeAp("ap1", 0, 0);
    const res = computePoint({ x: 5, y: 0 }, "5", [ap], []);
    expect(res.snrDb).toBeCloseTo(res.rssiDbm - res.noiseFloorDbm, 1);
  });
});
