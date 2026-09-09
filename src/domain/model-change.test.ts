import { describe, it, expect } from "vitest";
import { computeModelChange, applyModelChange } from "./model-change";
import { createAccessPoint } from "./factory";
import { getProduct } from "@/catalog";

describe("model change compatibility (mandatory)", () => {
  it("preserves position, name, and metadata across a model change", () => {
    const ap = createAccessPoint("cat9166", { x: 12, y: 8 }, "AP-Core-1");
    ap.assetTag = "TAG-42";
    ap.switchName = "sw-1";
    ap.notes = "ceiling near lobby";
    const next = getProduct("cat9130")!;
    const changed = applyModelChange(
      { ...ap, radios: [...ap.radios] },
      next,
      "2026-01-01T00:00:00Z",
    );
    expect(changed.position).toEqual({ x: 12, y: 8 });
    expect(changed.name).toBe("AP-Core-1");
    expect(changed.assetTag).toBe("TAG-42");
    expect(changed.switchName).toBe("sw-1");
    expect(changed.notes).toBe("ceiling near lobby");
    expect(changed.productId).toBe("cat9130");
  });

  it("marks a band unavailable when the new model drops it", () => {
    const ap = createAccessPoint("cat9166", { x: 0, y: 0 }); // has 2.4/5/6
    const next = getProduct("cat9130")!; // 2.4/5 only
    const summary = computeModelChange(ap, getProduct("cat9166"), next);
    expect(summary.bandsUnavailable).toContain("6");
    expect(summary.radiosRemoved).toContain("6");
    expect(summary.hasBlockingReview).toBe(true);
  });

  it("adds a band when the new model supports more", () => {
    const ap = createAccessPoint("cat9130", { x: 0, y: 0 }); // 2.4/5
    const next = getProduct("cat9166")!; // 2.4/5/6
    const summary = computeModelChange(ap, getProduct("cat9130"), next);
    expect(summary.bandsAvailable).toContain("6");
    expect(summary.radiosAdded).toContain("6");
  });

  it("compatible radio settings survive; the 6 GHz radio is dropped", () => {
    const ap = createAccessPoint("cat9166", { x: 0, y: 0 });
    // Set a valid 5 GHz channel width to check preservation.
    const r5 = ap.radios.find((r) => r.band === "5")!;
    r5.channelWidthMHz = 40;
    r5.txPowerDbm = 12;
    const next = getProduct("cat9130")!;
    const changed = applyModelChange(
      { ...ap, radios: ap.radios.map((r) => ({ ...r })) },
      next,
      "t",
    );
    const bands = changed.radios.map((r) => r.band);
    expect(bands).not.toContain("6");
    const newR5 = changed.radios.find((r) => r.band === "5")!;
    expect(newR5.channelWidthMHz).toBe(40); // preserved (supported)
    expect(newR5.txPowerDbm).toBe(12); // preserved (within max)
  });

  it("records override warnings for converted/reset settings", () => {
    const ap = createAccessPoint("cat9166", { x: 0, y: 0 });
    const next = getProduct("cat9130")!;
    const changed = applyModelChange(
      { ...ap, radios: ap.radios.map((r) => ({ ...r })) },
      next,
      "t",
    );
    expect(changed.modelOverrideWarnings.some((w) => w.includes("6 GHz"))).toBe(true);
  });

  it("captures a catalog snapshot so future catalog updates do not change the AP silently", () => {
    const ap = createAccessPoint("cat9130", { x: 0, y: 0 });
    const next = getProduct("cat9166")!;
    const changed = applyModelChange(
      { ...ap, radios: ap.radios.map((r) => ({ ...r })) },
      next,
      "2026-02-02",
    );
    expect(changed.catalogSnapshot?.model).toContain("9166");
    expect(changed.catalogSnapshot?.capturedAt).toBe("2026-02-02");
  });
});
