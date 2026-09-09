/**
 * Geometry toolkit for the wall editor and RF engine. Framework-independent,
 * deterministic, coordinates in METERS with a configurable numeric tolerance.
 * See design.md Addendum §C.
 */

export interface Vec2 {
  x: number;
  y: number;
}
export interface Seg {
  a: Vec2;
  b: Vec2;
}

export const DEFAULT_EPS = 1e-6;

export function sub(p: Vec2, q: Vec2): Vec2 {
  return { x: p.x - q.x, y: p.y - q.y };
}
export function add(p: Vec2, q: Vec2): Vec2 {
  return { x: p.x + q.x, y: p.y + q.y };
}
export function scale(p: Vec2, s: number): Vec2 {
  return { x: p.x * s, y: p.y * s };
}
export function dot(p: Vec2, q: Vec2): number {
  return p.x * q.x + p.y * q.y;
}
export function cross(p: Vec2, q: Vec2): number {
  return p.x * q.y - p.y * q.x;
}
export function len(p: Vec2): number {
  return Math.hypot(p.x, p.y);
}
export function dist(p: Vec2, q: Vec2): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Angle of a segment in degrees, clockwise from +X, normalized to [0,360). */
export function segmentAngleDeg(a: Vec2, b: Vec2): number {
  let d = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (d < 0) d += 360;
  return d;
}

/**
 * Proper intersection point of two segments, or null. Endpoints touching or
 * collinear overlaps return null (handled by join/merge instead) unless the
 * crossing is strictly interior.
 */
export function segmentIntersection(s1: Seg, s2: Seg, eps = DEFAULT_EPS): Vec2 | null {
  const r = sub(s1.b, s1.a);
  const s = sub(s2.b, s2.a);
  const denom = cross(r, s);
  if (Math.abs(denom) < eps) return null; // parallel or collinear
  const qp = sub(s2.a, s1.a);
  const t = cross(qp, s) / denom;
  const u = cross(qp, r) / denom;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  return { x: s1.a.x + t * r.x, y: s1.a.y + t * r.y };
}

export interface OnSegment {
  on: boolean;
  t: number; // param along segment [0,1] of the projection
  point: Vec2; // projected point
  distance: number; // perpendicular distance from p to the segment
}

/** Whether point p lies on segment within eps; also returns projection info. */
export function pointOnSegment(p: Vec2, seg: Seg, eps = DEFAULT_EPS): OnSegment {
  const ab = sub(seg.b, seg.a);
  const abLen2 = dot(ab, ab);
  let t = abLen2 < eps ? 0 : dot(sub(p, seg.a), ab) / abLen2;
  t = Math.min(Math.max(t, 0), 1);
  const point = add(seg.a, scale(ab, t));
  const distance = dist(p, point);
  return { on: distance <= eps, t, point, distance };
}

export type SnapType = "endpoint" | "segment" | "intersection" | "grid" | "axis" | "angle";

export interface SnapTarget {
  point: Vec2;
  type: SnapType;
  refId?: string;
  distance: number;
}

/**
 * Nearest snap target to p among candidates within radiusMeters. Deterministic:
 * ties resolved by snap-type priority then insertion order.
 */
export function nearestSnap(
  p: Vec2,
  candidates: SnapTarget[],
  radiusMeters: number,
): SnapTarget | null {
  const priority: Record<SnapType, number> = {
    endpoint: 0,
    intersection: 1,
    segment: 2,
    angle: 3,
    axis: 4,
    grid: 5,
  };
  let best: SnapTarget | null = null;
  for (const c of candidates) {
    const d = dist(p, c.point);
    if (d > radiusMeters) continue;
    const cand = { ...c, distance: d };
    if (
      !best ||
      cand.distance < best.distance - 1e-9 ||
      (Math.abs(cand.distance - best.distance) <= 1e-9 && priority[cand.type] < priority[best.type])
    ) {
      best = cand;
    }
  }
  return best;
}

/** Constrain a segment's endpoint to the nearest multiple of stepDeg. */
export function constrainAngle(from: Vec2, to: Vec2, stepDeg = 15): Vec2 {
  const d = dist(from, to);
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  return { x: from.x + Math.cos(snapped) * d, y: from.y + Math.sin(snapped) * d };
}

/** Split a polyline wall at a point lying on one of its segments. */
export function splitPolylineAt(
  polyline: Vec2[],
  point: Vec2,
  eps = 1e-4,
): [Vec2[], Vec2[]] | null {
  for (let i = 0; i < polyline.length - 1; i++) {
    const res = pointOnSegment(point, { a: polyline[i]!, b: polyline[i + 1]! }, eps);
    if (res.on) {
      const first = [...polyline.slice(0, i + 1), res.point];
      const second = [res.point, ...polyline.slice(i + 1)];
      return [first, second];
    }
  }
  return null;
}

/** Join two polylines if they share an endpoint within eps. */
export function joinPolylines(a: Vec2[], b: Vec2[], eps = 1e-4): Vec2[] | null {
  const aStart = a[0]!;
  const aEnd = a[a.length - 1]!;
  const bStart = b[0]!;
  const bEnd = b[b.length - 1]!;
  if (dist(aEnd, bStart) <= eps) return [...a, ...b.slice(1)];
  if (dist(aEnd, bEnd) <= eps) return [...a, ...[...b].reverse().slice(1)];
  if (dist(aStart, bEnd) <= eps) return [...b, ...a.slice(1)];
  if (dist(aStart, bStart) <= eps) return [...[...b].reverse(), ...a.slice(1)];
  return null;
}

/** Remove redundant collinear vertices within an angular tolerance (degrees). */
export function mergeCollinear(polyline: Vec2[], angleEpsDeg = 0.5): Vec2[] {
  if (polyline.length <= 2) return [...polyline];
  const out: Vec2[] = [polyline[0]!];
  for (let i = 1; i < polyline.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = polyline[i]!;
    const next = polyline[i + 1]!;
    const a1 = segmentAngleDeg(prev, cur);
    const a2 = segmentAngleDeg(cur, next);
    let diff = Math.abs(a1 - a2) % 360;
    if (diff > 180) diff = 360 - diff;
    if (diff > angleEpsDeg) out.push(cur);
  }
  out.push(polyline[polyline.length - 1]!);
  return out;
}

/** Number of times a segment crosses a closed polygon's edges. */
export function polygonCrossings(seg: Seg, polygon: Vec2[], eps = DEFAULT_EPS): number {
  let count = 0;
  for (let i = 0; i < polygon.length; i++) {
    const edge: Seg = { a: polygon[i]!, b: polygon[(i + 1) % polygon.length]! };
    if (segmentIntersection(seg, edge, eps)) count++;
  }
  return count;
}
