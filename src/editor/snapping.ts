/**
 * Snap-target assembly for the wall editor. Builds endpoint, segment,
 * intersection, grid, and axis candidates in world meters. Framework-independent.
 * See requirements.md §14.3.
 */
import { type Vec2, type SnapTarget, pointOnSegment, segmentIntersection } from "@/geometry";

export interface WallLike {
  id: string;
  polyline: Vec2[];
}

export interface SnapOptions {
  gridStepM: number;
  includeGrid: boolean;
  includeAxes: boolean;
  /** Reference point for axis snapping (e.g. the last committed vertex). */
  axisAnchor?: Vec2;
}

export function buildSnapTargets(cursor: Vec2, walls: WallLike[], opts: SnapOptions): SnapTarget[] {
  const targets: SnapTarget[] = [];

  // Endpoints and nearest-point-on-segment for each wall.
  for (const wall of walls) {
    for (const v of wall.polyline) {
      targets.push({ point: { ...v }, type: "endpoint", refId: wall.id, distance: 0 });
    }
    for (let i = 0; i < wall.polyline.length - 1; i++) {
      const proj = pointOnSegment(cursor, { a: wall.polyline[i]!, b: wall.polyline[i + 1]! });
      targets.push({ point: proj.point, type: "segment", refId: wall.id, distance: 0 });
    }
  }

  // Wall-wall intersections near the cursor.
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i]!;
      const b = walls[j]!;
      for (let k = 0; k < a.polyline.length - 1; k++) {
        for (let m = 0; m < b.polyline.length - 1; m++) {
          const x = segmentIntersection(
            { a: a.polyline[k]!, b: a.polyline[k + 1]! },
            { a: b.polyline[m]!, b: b.polyline[m + 1]! },
          );
          if (x) targets.push({ point: x, type: "intersection", distance: 0 });
        }
      }
    }
  }

  // Grid snapping.
  if (opts.includeGrid && opts.gridStepM > 0) {
    const gx = Math.round(cursor.x / opts.gridStepM) * opts.gridStepM;
    const gy = Math.round(cursor.y / opts.gridStepM) * opts.gridStepM;
    targets.push({ point: { x: gx, y: gy }, type: "grid", distance: 0 });
  }

  // Axis snapping relative to the last vertex (horizontal / vertical lock).
  if (opts.includeAxes && opts.axisAnchor) {
    targets.push({ point: { x: cursor.x, y: opts.axisAnchor.y }, type: "axis", distance: 0 });
    targets.push({ point: { x: opts.axisAnchor.x, y: cursor.y }, type: "axis", distance: 0 });
  }

  return targets;
}
