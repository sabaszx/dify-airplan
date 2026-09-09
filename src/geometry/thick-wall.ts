/**
 * Thick-wall geometry: expand a polyline centerline into a physical-width band,
 * compute the in-material path length a ray travels through a wall, and offset a
 * segment for centered / fixed-edge resizing. Pure, meters. See override §1.
 * Original code.
 */
import { type Vec2, type Seg, segmentIntersection, dist } from "./index";

/** A single wall segment as a filled rectangle (physical width). */
export interface WallRect {
  /** Corner points in order (a-left, b-left, b-right, a-right). */
  corners: [Vec2, Vec2, Vec2, Vec2];
  edges: [Seg, Seg, Seg, Seg];
}

function unitNormal(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Left-hand normal.
  return { x: -dy / len, y: dx / len };
}

/**
 * Build a rectangle for one centerline segment expanded by `thicknessM`.
 * `alignment` controls which side the width grows toward:
 *   "center" (default), "left", or "right" relative to a->b direction.
 */
export function segmentRect(
  a: Vec2,
  b: Vec2,
  thicknessM: number,
  alignment: "center" | "left" | "right" = "center",
): WallRect {
  const n = unitNormal(a, b);
  const half = thicknessM / 2;
  let offL: number;
  let offR: number;
  if (alignment === "center") {
    offL = half;
    offR = half;
  } else if (alignment === "left") {
    offL = thicknessM;
    offR = 0;
  } else {
    offL = 0;
    offR = thicknessM;
  }
  const aL = { x: a.x + n.x * offL, y: a.y + n.y * offL };
  const bL = { x: b.x + n.x * offL, y: b.y + n.y * offL };
  const bR = { x: b.x - n.x * offR, y: b.y - n.y * offR };
  const aR = { x: a.x - n.x * offR, y: a.y - n.y * offR };
  const corners: [Vec2, Vec2, Vec2, Vec2] = [aL, bL, bR, aR];
  const edges: [Seg, Seg, Seg, Seg] = [
    { a: aL, b: bL },
    { a: bL, b: bR },
    { a: bR, b: aR },
    { a: aR, b: aL },
  ];
  return { corners, edges };
}

/** Point-in-convex-quad test (winding sign consistent). */
function pointInQuad(p: Vec2, q: [Vec2, Vec2, Vec2, Vec2]): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const s = Math.sign(cross);
    if (s !== 0) {
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/**
 * Length a ray (from `origin` to `target`) travels inside a wall rectangle.
 * Returns 0 if the ray does not pass through the rectangle. For a perpendicular
 * crossing this equals the thickness; for an oblique crossing it is longer.
 * See override §1.5 (documented approximation: straight-line entry/exit through
 * the segment's physical rectangle; refraction/curvature are ignored).
 */
export function inMaterialLength(origin: Vec2, target: Vec2, rect: WallRect): number {
  const ray: Seg = { a: origin, b: target };
  const hits: Vec2[] = [];
  for (const edge of rect.edges) {
    const x = segmentIntersection(ray, edge);
    if (x) hits.push(x);
  }
  // Include endpoints that fall inside the rectangle (ray starting/ending inside).
  if (pointInQuad(origin, rect.corners)) hits.push(origin);
  if (pointInQuad(target, rect.corners)) hits.push(target);

  if (hits.length < 2) return 0;
  // Longest chord between the two most separated hit points.
  let maxLen = 0;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      maxLen = Math.max(maxLen, dist(hits[i]!, hits[j]!));
    }
  }
  return maxLen;
}

/** Convenience: in-material length across a whole polyline wall. */
export function polylineInMaterialLength(
  origin: Vec2,
  target: Vec2,
  polyline: Vec2[],
  thicknessM: number,
  alignment: "center" | "left" | "right" = "center",
): number {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const rect = segmentRect(polyline[i]!, polyline[i + 1]!, thicknessM, alignment);
    total += inMaterialLength(origin, target, rect);
  }
  return total;
}
