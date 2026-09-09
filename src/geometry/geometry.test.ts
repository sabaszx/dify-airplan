import { describe, it, expect } from "vitest";
import {
  segmentIntersection,
  pointOnSegment,
  nearestSnap,
  constrainAngle,
  splitPolylineAt,
  joinPolylines,
  mergeCollinear,
  polygonCrossings,
  segmentAngleDeg,
  dist,
  type SnapTarget,
} from "./index";

describe("segmentIntersection", () => {
  it("finds interior crossing point", () => {
    const p = segmentIntersection(
      { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { a: { x: 5, y: -5 }, b: { x: 5, y: 5 } },
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(5, 6);
    expect(p!.y).toBeCloseTo(0, 6);
  });
  it("returns null for parallel segments", () => {
    expect(
      segmentIntersection(
        { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
        { a: { x: 0, y: 1 }, b: { x: 10, y: 1 } },
      ),
    ).toBeNull();
  });
  it("returns null when they do not overlap", () => {
    expect(
      segmentIntersection(
        { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
        { a: { x: 5, y: -1 }, b: { x: 5, y: 1 } },
      ),
    ).toBeNull();
  });
});

describe("pointOnSegment", () => {
  it("detects a point on the segment", () => {
    const r = pointOnSegment({ x: 5, y: 0 }, { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
    expect(r.on).toBe(true);
    expect(r.t).toBeCloseTo(0.5, 6);
  });
  it("reports perpendicular distance for a point off the segment", () => {
    const r = pointOnSegment({ x: 5, y: 3 }, { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
    expect(r.on).toBe(false);
    expect(r.distance).toBeCloseTo(3, 6);
  });
});

describe("nearestSnap", () => {
  const targets: SnapTarget[] = [
    { point: { x: 0, y: 0 }, type: "grid", distance: 0 },
    { point: { x: 0.02, y: 0 }, type: "endpoint", distance: 0 },
    { point: { x: 5, y: 5 }, type: "endpoint", distance: 0 },
  ];
  it("prefers the closest target within radius", () => {
    const s = nearestSnap({ x: 0.01, y: 0 }, targets, 0.1);
    expect(s?.type).toBe("endpoint");
  });
  it("returns null when nothing is within radius", () => {
    expect(nearestSnap({ x: 100, y: 100 }, targets, 0.1)).toBeNull();
  });
  it("breaks ties by snap-type priority (endpoint over grid)", () => {
    const tie: SnapTarget[] = [
      { point: { x: 1, y: 0 }, type: "grid", distance: 0 },
      { point: { x: 1, y: 0 }, type: "endpoint", distance: 0 },
    ];
    expect(nearestSnap({ x: 1, y: 0 }, tie, 0.5)?.type).toBe("endpoint");
  });
});

describe("constrainAngle", () => {
  it("snaps a near-horizontal segment to 0 degrees", () => {
    const p = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 0.3 }, 15);
    expect(segmentAngleDeg({ x: 0, y: 0 }, p)).toBeCloseTo(0, 3);
    // length preserved
    expect(dist({ x: 0, y: 0 }, p)).toBeCloseTo(Math.hypot(10, 0.3), 6);
  });
  it("snaps a ~40 degree segment to 45 degrees", () => {
    const p = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 8.4 }, 15);
    expect(segmentAngleDeg({ x: 0, y: 0 }, p)).toBeCloseTo(45, 3);
  });
});

describe("splitPolylineAt", () => {
  it("splits a wall at a point on a segment, preserving the vertex", () => {
    const res = splitPolylineAt(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      { x: 4, y: 0 },
    );
    expect(res).not.toBeNull();
    const [first, second] = res!;
    expect(first[first.length - 1]).toEqual({ x: 4, y: 0 });
    expect(second[0]).toEqual({ x: 4, y: 0 });
  });
});

describe("joinPolylines", () => {
  it("joins two walls sharing an endpoint", () => {
    const joined = joinPolylines(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      [
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
    );
    expect(joined).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ]);
  });
  it("reverses one when tail meets tail", () => {
    const joined = joinPolylines(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      [
        { x: 9, y: 0 },
        { x: 5, y: 0 },
      ],
    );
    expect(joined).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 9, y: 0 },
    ]);
  });
  it("returns null when no endpoints coincide", () => {
    expect(
      joinPolylines(
        [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        [
          { x: 9, y: 9 },
          { x: 10, y: 10 },
        ],
      ),
    ).toBeNull();
  });
});

describe("mergeCollinear", () => {
  it("removes a redundant collinear midpoint", () => {
    const merged = mergeCollinear([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(merged).toHaveLength(2);
  });
  it("keeps corners", () => {
    const merged = mergeCollinear([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ]);
    expect(merged).toHaveLength(3);
  });
});

describe("polygonCrossings", () => {
  it("counts crossings of a segment through a square", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const crossings = polygonCrossings({ a: { x: -1, y: 5 }, b: { x: 11, y: 5 } }, square);
    expect(crossings).toBe(2);
  });
});
