/**
 * Pure wall-editing operations used by the canvas editing gestures and the
 * command layer. Framework-independent, meters. Openings keep a parametric
 * (segmentIndex, t) position so they stay attached when the wall changes.
 * See requirements.md §14.6 and design.md Addendum §C/§E.
 */
import { type Vec2, dist, pointOnSegment } from "@/geometry";
import type { Wall, Opening } from "@/domain/model";

/** Move a single vertex to a new position (immutably returns a new polyline). */
export function moveVertex(polyline: Vec2[], index: number, to: Vec2): Vec2[] {
  return polyline.map((p, i) => (i === index ? { ...to } : { ...p }));
}

/** Translate the whole polyline by a delta. */
export function translatePolyline(polyline: Vec2[], dx: number, dy: number): Vec2[] {
  return polyline.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Insert a vertex on the segment nearest to `point`. Returns new polyline and
 *  the index of the inserted vertex, or null if no segment is close enough. */
export function insertVertexNear(
  polyline: Vec2[],
  point: Vec2,
  toleranceM: number,
): { polyline: Vec2[]; index: number } | null {
  let bestSeg = -1;
  let bestDist = Infinity;
  let bestProj: Vec2 | null = null;
  for (let i = 0; i < polyline.length - 1; i++) {
    const res = pointOnSegment(point, { a: polyline[i]!, b: polyline[i + 1]! });
    if (res.distance < bestDist) {
      bestDist = res.distance;
      bestSeg = i;
      bestProj = res.point;
    }
  }
  if (bestSeg < 0 || bestDist > toleranceM || !bestProj) return null;
  const next = [...polyline.slice(0, bestSeg + 1), bestProj, ...polyline.slice(bestSeg + 1)];
  return { polyline: next, index: bestSeg + 1 };
}

/** Remove a vertex; refuses to drop below 2 vertices. */
export function removeVertex(polyline: Vec2[], index: number): Vec2[] {
  if (polyline.length <= 2) return polyline;
  return polyline.filter((_, i) => i !== index);
}

/** Find the vertex index within tolerance of a point, or -1. */
export function vertexAt(polyline: Vec2[], point: Vec2, toleranceM: number): number {
  let best = -1;
  let bestDist = toleranceM;
  for (let i = 0; i < polyline.length; i++) {
    const d = dist(polyline[i]!, point);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** World-space position of an opening on its parent wall. */
export function openingWorldPoint(wall: Wall, opening: Opening): Vec2 | null {
  const a = wall.polyline[opening.segmentIndex];
  const b = wall.polyline[opening.segmentIndex + 1];
  if (!a || !b) return null;
  return { x: a.x + (b.x - a.x) * opening.t, y: a.y + (b.y - a.y) * opening.t };
}

/** Attach an opening at the point on the wall nearest `point`. */
export function attachOpeningAt(
  wall: Wall,
  point: Vec2,
  make: (segmentIndex: number, t: number) => Opening,
): Opening | null {
  let bestSeg = -1;
  let bestDist = Infinity;
  let bestT = 0;
  for (let i = 0; i < wall.polyline.length - 1; i++) {
    const res = pointOnSegment(point, { a: wall.polyline[i]!, b: wall.polyline[i + 1]! });
    if (res.distance < bestDist) {
      bestDist = res.distance;
      bestSeg = i;
      bestT = res.t;
    }
  }
  if (bestSeg < 0) return null;
  return make(bestSeg, bestT);
}

/**
 * Build the RF wall-attenuation inputs for a wall, applying openings as
 * replacement sub-segments. Returns a list of {a,b,attenuation} pieces so the
 * engine can treat an opening span with its own (lower) attenuation.
 * See design.md Addendum §E.
 */
export interface WallPiece {
  a: Vec2;
  b: Vec2;
  attenuationDb: Record<"2.4" | "5" | "6", number>;
  thicknessM: number;
}

export function wallPieces(
  wall: Wall,
  materialAttenuation: Record<"2.4" | "5" | "6", number>,
): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (let i = 0; i < wall.polyline.length - 1; i++) {
    const a = wall.polyline[i]!;
    const b = wall.polyline[i + 1]!;
    const segLen = dist(a, b);
    // Collect openings on this segment, sorted by t.
    const segOpenings = wall.openings.filter((o) => o.segmentIndex === i).sort((x, y) => x.t - y.t);
    if (segOpenings.length === 0 || segLen < 1e-9) {
      pieces.push({ a, b, attenuationDb: materialAttenuation, thicknessM: wall.thicknessM });
      continue;
    }
    let cursorT = 0;
    for (const o of segOpenings) {
      const halfT = o.widthM / 2 / segLen;
      const startT = Math.max(0, o.t - halfT);
      const endT = Math.min(1, o.t + halfT);
      if (startT > cursorT) {
        pieces.push({
          a: lerp(a, b, cursorT),
          b: lerp(a, b, startT),
          attenuationDb: materialAttenuation,
          thicknessM: wall.thicknessM,
        });
      }
      // Opening span uses the opening's own attenuation.
      pieces.push({
        a: lerp(a, b, startT),
        b: lerp(a, b, endT),
        attenuationDb: o.attenuationDb,
        thicknessM: wall.thicknessM,
      });
      cursorT = endT;
    }
    if (cursorT < 1) {
      pieces.push({
        a: lerp(a, b, cursorT),
        b,
        attenuationDb: materialAttenuation,
        thicknessM: wall.thicknessM,
      });
    }
  }
  return pieces;
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
