import { describe, it, expect } from "vitest";
import {
  moveVertex,
  translatePolyline,
  insertVertexNear,
  removeVertex,
  vertexAt,
  openingWorldPoint,
  attachOpeningAt,
  wallPieces,
} from "./wall-editing";
import type { Wall, Opening } from "@/domain/model";

const line: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
];

describe("vertex editing", () => {
  it("moves a vertex", () => {
    const next = moveVertex(line, 1, { x: 12, y: 3 });
    expect(next[1]).toEqual({ x: 12, y: 3 });
    expect(next[0]).toEqual({ x: 0, y: 0 });
  });

  it("translates the whole polyline", () => {
    const next = translatePolyline(line, 5, -2);
    expect(next).toEqual([
      { x: 5, y: -2 },
      { x: 15, y: -2 },
    ]);
  });

  it("inserts a vertex on the nearest segment", () => {
    const res = insertVertexNear(line, { x: 4, y: 0.05 }, 0.2);
    expect(res).not.toBeNull();
    expect(res!.index).toBe(1);
    expect(res!.polyline[1]!.x).toBeCloseTo(4, 6);
    expect(res!.polyline).toHaveLength(3);
  });

  it("does not insert when no segment is near enough", () => {
    expect(insertVertexNear(line, { x: 4, y: 5 }, 0.2)).toBeNull();
  });

  it("removes a vertex but keeps at least 2", () => {
    const three = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(removeVertex(three, 1)).toHaveLength(2);
    expect(removeVertex(line, 0)).toHaveLength(2); // refuses to go below 2
  });

  it("finds a vertex within tolerance", () => {
    expect(vertexAt(line, { x: 10.05, y: 0.05 }, 0.2)).toBe(1);
    expect(vertexAt(line, { x: 5, y: 0 }, 0.2)).toBe(-1);
  });
});

function wallWithOpening(): Wall {
  const opening: Opening = {
    id: "o1",
    type: "door",
    segmentIndex: 0,
    t: 0.5,
    widthM: 1.0,
    heightM: 2.1,
    bottomElevationM: 0,
    open: false,
    attenuationDb: { "2.4": 2, "5": 3, "6": 3 },
  };
  return {
    id: "w1",
    polyline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    materialId: "concrete",
    thicknessM: 0.15,
    heightM: 2.7,
    bottomElevationM: 0,
    openings: [opening],
  };
}

describe("openings", () => {
  it("computes an opening's world point parametrically", () => {
    const wall = wallWithOpening();
    expect(openingWorldPoint(wall, wall.openings[0]!)).toEqual({ x: 5, y: 0 });
  });

  it("opening stays attached after the wall is translated", () => {
    const wall = wallWithOpening();
    wall.polyline = translatePolyline(wall.polyline, 3, 4);
    // Parametric position unchanged; world point follows the wall.
    expect(openingWorldPoint(wall, wall.openings[0]!)).toEqual({ x: 8, y: 4 });
  });

  it("attaches an opening at the nearest point on the wall", () => {
    const wall = wallWithOpening();
    let i = 0;
    const o = attachOpeningAt(wall, { x: 2, y: 0.1 }, (segmentIndex, t) => ({
      id: `o${++i}`,
      type: "window",
      segmentIndex,
      t,
      widthM: 1,
      heightM: 1.2,
      bottomElevationM: 1,
      open: false,
      attenuationDb: { "2.4": 3, "5": 6, "6": 8 },
    }));
    expect(o?.segmentIndex).toBe(0);
    expect(o?.t).toBeCloseTo(0.2, 6);
  });

  it("wallPieces splits the segment so the opening span uses lower attenuation", () => {
    const wall = wallWithOpening();
    const material = { "2.4": 12, "5": 15, "6": 17 };
    const pieces = wallPieces(wall, material);
    // Expect: solid | opening | solid.
    expect(pieces).toHaveLength(3);
    expect(pieces[0]!.attenuationDb).toEqual(material);
    expect(pieces[1]!.attenuationDb).toEqual(wall.openings[0]!.attenuationDb);
    expect(pieces[2]!.attenuationDb).toEqual(material);
    // Opening span is centered at x=5 with width 1 => [4.5, 5.5].
    expect(pieces[1]!.a.x).toBeCloseTo(4.5, 6);
    expect(pieces[1]!.b.x).toBeCloseTo(5.5, 6);
  });

  it("a wall with no openings yields one piece per segment", () => {
    const wall = wallWithOpening();
    wall.openings = [];
    expect(wallPieces(wall, { "2.4": 12, "5": 15, "6": 17 })).toHaveLength(1);
  });
});
