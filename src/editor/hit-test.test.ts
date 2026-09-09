import { describe, it, expect } from "vitest";
import { hitTest, topHit } from "./hit-test";
import { createFloor, createAccessPoint } from "@/domain/factory";
import type { Floor } from "@/domain/model";

function floorWith(): Floor {
  const floor = createFloor(0);
  floor.plan = {
    id: "plan1",
    fileName: "f.png",
    imageSrc: "",
    widthPx: 1000,
    heightPx: 800,
    metersPerPixel: 0.05,
    locked: false,
    opacity: 1,
  };
  floor.walls.push({
    id: "w1",
    polyline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    materialId: "concrete",
    thicknessM: 0.15,
    heightM: 2.7,
    bottomElevationM: 0,
    openings: [],
  });
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 5, y: 0 })); // overlaps the wall midpoint
  return floor;
}

describe("hit-testing (mandatory)", () => {
  it("returns the AP as topmost when it overlaps a wall", () => {
    const floor = floorWith();
    const top = topHit(floor, { x: 5, y: 0 }, 0.5);
    expect(top.kind).toBe("access-point");
  });

  it("returns the wall (not AP) when clicking the wall away from the AP", () => {
    const floor = floorWith();
    const top = topHit(floor, { x: 1, y: 0 }, 0.3);
    expect(top.kind).toBe("wall");
  });

  it("lists overlapping objects so the user can select behind", () => {
    const floor = floorWith();
    const hits = hitTest(floor, { x: 5, y: 0 }, 0.5);
    const kinds = hits.map((h) => h.kind);
    expect(kinds).toContain("access-point");
    expect(kinds).toContain("wall");
    // AP appears before wall (topmost first).
    expect(kinds.indexOf("access-point")).toBeLessThan(kinds.indexOf("wall"));
  });

  it("returns background on an empty area of a floor with a plan", () => {
    const floor = floorWith();
    const top = topHit(floor, { x: 40, y: 40 }, 0.3);
    expect(top.kind).toBe("background");
  });

  it("picks a wall vertex over the wall body near a corner", () => {
    const floor = floorWith();
    const hits = hitTest(floor, { x: 0, y: 0 }, 0.3);
    expect(hits[0]!.kind === "wall-vertex" || hits[0]!.kind === "access-point").toBe(true);
    expect(hits.some((h) => h.kind === "wall-vertex")).toBe(true);
  });
});
