/**
 * Object-aware canvas hit-testing. Given a world-space point and the floor's
 * objects, returns the topmost selectable object plus the full overlap list so
 * the UI can offer "Select Behind" / "Select From List". Pure and testable.
 * See override §8. Coordinates in meters.
 */
import { type Vec2, dist, pointOnSegment } from "@/geometry";
import type { Floor } from "@/domain/model";
import { openingWorldPoint } from "./wall-editing";

export type HitKind =
  | "access-point"
  | "wall-vertex"
  | "opening"
  | "wall"
  | "requirement-zone"
  | "background"
  | "empty";

export interface Hit {
  kind: HitKind;
  id: string; // object id ("" for background/empty)
  label: string;
  extra?: { vertexIndex?: number; wallId?: string };
  /** Z-priority: higher = on top / picked first. */
  priority: number;
  distance: number;
}

/** Point-in-polygon test (ray casting). */
function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const intersect =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Return all hits under `world`, ordered topmost-first. `toleranceM` is the
 * pick radius (already zoom-adjusted by the caller). Always includes a
 * background/empty entry at the end so a menu can still open on blank canvas.
 */
export function hitTest(floor: Floor, world: Vec2, toleranceM: number): Hit[] {
  const hits: Hit[] = [];

  // Access points (highest priority).
  for (const ap of floor.accessPoints) {
    const d = dist(ap.position, world);
    if (d <= toleranceM * 1.4) {
      hits.push({ kind: "access-point", id: ap.id, label: ap.name, priority: 100, distance: d });
    }
  }

  // Wall vertices (above wall bodies).
  for (const wall of floor.walls) {
    for (let i = 0; i < wall.polyline.length; i++) {
      const d = dist(wall.polyline[i]!, world);
      if (d <= toleranceM) {
        hits.push({
          kind: "wall-vertex",
          id: `${wall.id}:${i}`,
          label: `Vertex ${i + 1} of wall`,
          extra: { vertexIndex: i, wallId: wall.id },
          priority: 90,
          distance: d,
        });
      }
    }
  }

  // Openings (above wall bodies).
  for (const wall of floor.walls) {
    for (const opening of wall.openings) {
      const wp = openingWorldPoint(wall, opening);
      if (!wp) continue;
      const d = dist(wp, world);
      if (d <= toleranceM * 1.2) {
        hits.push({
          kind: "opening",
          id: opening.id,
          label: `${opening.type} on wall`,
          extra: { wallId: wall.id },
          priority: 80,
          distance: d,
        });
      }
    }
  }

  // Wall bodies.
  for (const wall of floor.walls) {
    let best = Infinity;
    for (let s = 0; s < wall.polyline.length - 1; s++) {
      const res = pointOnSegment(world, { a: wall.polyline[s]!, b: wall.polyline[s + 1]! });
      best = Math.min(best, res.distance);
    }
    if (best <= toleranceM * 1.6) {
      hits.push({ kind: "wall", id: wall.id, label: "Wall", priority: 60, distance: best });
    }
  }

  // Requirement zones (polygon interiors).
  for (const zone of floor.requirements) {
    if (pointInPolygon(world, zone.polygon)) {
      hits.push({
        kind: "requirement-zone",
        id: zone.id,
        label: zone.name,
        priority: 40,
        distance: 0,
      });
    }
  }

  // Background if a floor plan exists, else empty.
  hits.push(
    floor.plan
      ? {
          kind: "background",
          id: floor.plan.id,
          label: "Floor plan",
          priority: 10,
          distance: Infinity,
        }
      : { kind: "empty", id: "", label: "Canvas", priority: 0, distance: Infinity },
  );

  // Topmost first: higher priority, then nearer.
  hits.sort((a, b) => b.priority - a.priority || a.distance - b.distance);
  return hits;
}

/** The single topmost selectable object (excluding background/empty when others exist). */
export function topHit(floor: Floor, world: Vec2, toleranceM: number): Hit {
  const hits = hitTest(floor, world, toleranceM);
  const selectable = hits.find((h) => h.kind !== "background" && h.kind !== "empty");
  return selectable ?? hits[hits.length - 1]!;
}
