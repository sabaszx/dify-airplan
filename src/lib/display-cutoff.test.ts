import { describe, it, expect } from "vitest";
import {
  DEFAULT_DISPLAY_CUTOFF,
  validateCutoff,
  cutoffFor,
  passesCutoff,
  metricLabel,
  belowCutoffLegend,
  CUTOFF_MIN_DBM,
  CUTOFF_MAX_DBM,
} from "./display-cutoff";

describe("display cutoff (mandatory §2)", () => {
  it("values at the cutoff remain visible; below are hidden", () => {
    expect(passesCutoff(-67, -67)).toBe(true); // at cutoff -> visible
    expect(passesCutoff(-60, -67)).toBe(true); // stronger -> visible
    expect(passesCutoff(-70, -67)).toBe(false); // weaker -> hidden
  });

  it("rejects NaN / Infinity / empty / out-of-range", () => {
    expect(validateCutoff(NaN).ok).toBe(false);
    expect(validateCutoff(Infinity).ok).toBe(false);
    expect(validateCutoff("").ok).toBe(false);
    expect(validateCutoff(undefined).ok).toBe(false);
    expect(validateCutoff(CUTOFF_MIN_DBM - 1).ok).toBe(false);
    expect(validateCutoff(CUTOFF_MAX_DBM + 1).ok).toBe(false);
    expect(validateCutoff(-67).ok).toBe(true);
    expect(validateCutoff("-67").value).toBe(-67);
  });

  it("uses per-band Wi-Fi cutoffs and per-technology BLE/UWB thresholds", () => {
    const c = {
      ...DEFAULT_DISPLAY_CUTOFF,
      wifi: { "2.4": -80, "5": -70, "6": -68 },
      ble: -85,
      uwb: -90,
    };
    expect(cutoffFor(c, "WIFI", "2.4")).toBe(-80);
    expect(cutoffFor(c, "WIFI", "5")).toBe(-70);
    expect(cutoffFor(c, "WIFI", "6")).toBe(-68);
    expect(cutoffFor(c, "BLE", "2.4")).toBe(-85);
    expect(cutoffFor(c, "UWB", "5")).toBe(-90);
  });

  it("technologies keep independent cutoff settings", () => {
    const c = { ...DEFAULT_DISPLAY_CUTOFF };
    c.wifi = { ...c.wifi, "5": -60 };
    // Changing Wi-Fi 5 GHz does not affect BLE/UWB or Wi-Fi 2.4/6.
    expect(cutoffFor(c, "WIFI", "5")).toBe(-60);
    expect(cutoffFor(c, "WIFI", "2.4")).toBe(DEFAULT_DISPLAY_CUTOFF.wifi["2.4"]);
    expect(cutoffFor(c, "BLE", "2.4")).toBe(DEFAULT_DISPLAY_CUTOFF.ble);
  });

  it("labels BLE/UWB with the correct metric name/unit (not misnamed RSSI)", () => {
    expect(metricLabel("WIFI").label).toBe("RSSI");
    expect(metricLabel("UWB").label).toContain("received power");
    expect(metricLabel("UWB").unit).toBe("dBm");
  });

  it("produces the required below-cutoff legend line", () => {
    expect(belowCutoffLegend(-67)).toBe("Values below -67 dBm are hidden.");
  });
});
