import { describe, it, expect } from "vitest";
import { segmentRect, inMaterialLength, polylineInMaterialLength } from "./thick-wall";
import { dist } from "./index";

describe("thick-wall geometry (mandatory)", () => {
  // A tall vertical wall segment centered on x=5, thickness 0.2 m => x in [4.9, 5.1].
  const rect = segmentRect({ x: 5, y: -50 }, { x: 5, y: 50 }, 0.2, "center");

  it("perpendicular crossing path length equals the thickness", () => {
    const len = inMaterialLength({ x: 0, y: 0 }, { x: 10, y: 0 }, rect);
    expect(len).toBeCloseTo(0.2, 6);
  });

  it("oblique crossing produces a longer in-material path than perpendicular", () => {
    // 45-degree crossing: path length ≈ thickness / cos(45) = 0.2 * √2 ≈ 0.283.
    const perpendicular = inMaterialLength({ x: 0, y: 0 }, { x: 10, y: 0 }, rect);
    const oblique = inMaterialLength({ x: 0, y: 0 }, { x: 10, y: 10 }, rect);
    expect(oblique).toBeGreaterThan(perpendicular);
    expect(oblique).toBeCloseTo(0.2 * Math.SQRT2, 2);
  });

  it("returns 0 when the ray misses the wall", () => {
    // Ray entirely on the left side (x < 4.9), never entering the band.
    expect(inMaterialLength({ x: 0, y: 0 }, { x: 4, y: 10 }, rect)).toBe(0);
  });

  it("centered alignment expands equally about the centerline", () => {
    const r = segmentRect({ x: 0, y: 0 }, { x: 0, y: 10 }, 0.4, "center");
    // Left corners at x=+0.2, right corners at x=-0.2 (left normal is -dy,dx = (-1,0)? for a->b up).
    const xs = r.corners.map((c) => c.x).sort((a, b) => a - b);
    expect(Math.abs(xs[0]!)).toBeCloseTo(0.2, 6);
    expect(Math.abs(xs[3]!)).toBeCloseTo(0.2, 6);
  });

  it("fixed-edge (left) alignment keeps one edge on the centerline", () => {
    const r = segmentRect({ x: 0, y: 0 }, { x: 0, y: 10 }, 0.4, "left");
    const xs = r.corners.map((c) => c.x);
    // One edge stays at x=0, the other at the full thickness offset.
    expect(Math.min(...xs.map(Math.abs))).toBeCloseTo(0, 6);
    expect(Math.max(...xs.map(Math.abs))).toBeCloseTo(0.4, 6);
  });

  it("polyline in-material length sums across segments", () => {
    const poly = [
      { x: 5, y: -5 },
      { x: 5, y: 5 },
    ];
    const len = polylineInMaterialLength({ x: 0, y: 0 }, { x: 10, y: 0 }, poly, 0.2);
    expect(len).toBeCloseTo(0.2, 6);
  });

  it("thicker wall yields a longer perpendicular in-material length", () => {
    const thin = segmentRect({ x: 5, y: -5 }, { x: 5, y: 5 }, 0.1, "center");
    const thick = segmentRect({ x: 5, y: -5 }, { x: 5, y: 5 }, 0.3, "center");
    const lThin = inMaterialLength({ x: 0, y: 0 }, { x: 10, y: 0 }, thin);
    const lThick = inMaterialLength({ x: 0, y: 0 }, { x: 10, y: 0 }, thick);
    expect(lThick).toBeGreaterThan(lThin);
    void dist;
  });
});
