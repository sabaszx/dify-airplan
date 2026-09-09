/**
 * Vector math and segment intersection for the RF engine.
 * Framework-independent, no DOM. All coordinates are in meters. See design.md §3.4.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

export function distance(p: Point, q: Point): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Azimuth in degrees from `from` to `to`, measured clockwise from +X axis. */
export function azimuthDeg(from: Point, to: Point): number {
  const deg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return normalizeDeg(deg);
}

/** Normalize an angle to (-180, 180]. */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Returns true if segments p1p2 and p3p4 properly intersect (cross). Collinear
 * overlaps and shared endpoints are treated conservatively (not counted) to keep
 * wall-loss accumulation stable and deterministic.
 */
export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const d1 = cross(sub(s2.b, s2.a), sub(s1.a, s2.a));
  const d2 = cross(sub(s2.b, s2.a), sub(s1.b, s2.a));
  const d3 = cross(sub(s1.b, s1.a), sub(s2.a, s1.a));
  const d4 = cross(sub(s1.b, s1.a), sub(s2.b, s1.a));

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function sub(p: Point, q: Point): Point {
  return { x: p.x - q.x, y: p.y - q.y };
}

function cross(p: Point, q: Point): number {
  return p.x * q.y - p.y * q.x;
}
