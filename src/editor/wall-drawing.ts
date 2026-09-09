/**
 * Continuous wall-drawing controller — a pure, framework-independent state
 * machine so the interaction is testable without a DOM. The React canvas drives
 * it with pointer/keyboard events. See requirements.md §14.2 and design.md §C.
 *
 * Workflow: click adds vertices; double-click/Enter finishes; Escape cancels the
 * current segment, a second Escape exits; Backspace removes the last uncommitted
 * vertex; Shift constrains angle; Alt disables snapping; a numeric entry sets an
 * exact segment length. The same material stays selected after finishing.
 */
import {
  type Vec2,
  type SnapTarget,
  nearestSnap,
  constrainAngle,
  dist,
  segmentAngleDeg,
} from "@/geometry";

export interface DrawingState {
  active: boolean;
  /** Committed vertices of the polyline in progress (meters). */
  vertices: Vec2[];
  /** Live preview point (snapped) for the next segment. */
  preview: Vec2 | null;
  materialId: string;
  snapEnabled: boolean;
  angleConstrained: boolean;
}

export interface DrawResult {
  /** A finished polyline ready to commit as a wall, if any. */
  finished: Vec2[] | null;
  /** True once the tool has fully exited drawing mode. */
  exited: boolean;
}

export function createDrawingState(materialId: string): DrawingState {
  return {
    active: true,
    vertices: [],
    preview: null,
    materialId,
    snapEnabled: true,
    angleConstrained: false,
  };
}

/** Resolve where a pointer at `raw` should land, applying snap + angle rules. */
export function resolvePoint(
  state: DrawingState,
  raw: Vec2,
  snapTargets: SnapTarget[],
  snapRadiusMeters: number,
): Vec2 {
  let p = raw;
  const last = state.vertices[state.vertices.length - 1];
  if (state.angleConstrained && last) {
    p = constrainAngle(last, p, 15);
  }
  if (state.snapEnabled) {
    const snap = nearestSnap(p, snapTargets, snapRadiusMeters);
    if (snap) p = snap.point;
  }
  return p;
}

/** Add a vertex (on click). Closes the polyline if clicking near the start. */
export function addVertex(state: DrawingState, point: Vec2, closeThreshold = 0.2): DrawResult {
  if (!state.active) return { finished: null, exited: false };
  const start = state.vertices[0];
  if (start && state.vertices.length >= 2 && dist(point, start) <= closeThreshold) {
    return finishDrawing(state, true);
  }
  state.vertices.push(point);
  return { finished: null, exited: false };
}

/** Update the live preview point (on move). */
export function updatePreview(state: DrawingState, point: Vec2): void {
  state.preview = point;
}

/** Finish the current polyline (double-click / Enter / closed). */
export function finishDrawing(state: DrawingState, closed = false): DrawResult {
  const verts = closed ? [...state.vertices, state.vertices[0]!] : [...state.vertices];
  const finished = verts.length >= 2 ? verts : null;
  // Keep the tool active and the same material selected for the next wall.
  state.vertices = [];
  state.preview = null;
  return { finished, exited: false };
}

/**
 * Escape handling: first press cancels the in-progress segment (drops the last
 * vertex); if there is nothing in progress, it exits drawing mode.
 */
export function escape(state: DrawingState): DrawResult {
  if (state.vertices.length > 0) {
    state.vertices = [];
    state.preview = null;
    return { finished: null, exited: false };
  }
  state.active = false;
  return { finished: null, exited: true };
}

/** Backspace removes the most recent uncommitted vertex. */
export function removeLastVertex(state: DrawingState): void {
  state.vertices.pop();
}

/** Commit a segment of an exact length from the last vertex toward the preview. */
export function commitExactLength(state: DrawingState, lengthMeters: number): DrawResult {
  const last = state.vertices[state.vertices.length - 1];
  const dir = state.preview;
  if (!last || !dir) return { finished: null, exited: false };
  const ang = Math.atan2(dir.y - last.y, dir.x - last.x);
  const point = {
    x: last.x + Math.cos(ang) * lengthMeters,
    y: last.y + Math.sin(ang) * lengthMeters,
  };
  return addVertex(state, point);
}

/** Live measurements shown near the cursor while drawing. */
export interface LiveMeasure {
  segmentLengthM: number;
  totalLengthM: number;
  angleDeg: number;
}

export function liveMeasure(state: DrawingState): LiveMeasure | null {
  const last = state.vertices[state.vertices.length - 1];
  if (!last || !state.preview) {
    // Total of committed segments even without a preview.
    return { segmentLengthM: 0, totalLengthM: polylineLength(state.vertices), angleDeg: 0 };
  }
  const segLen = dist(last, state.preview);
  return {
    segmentLengthM: segLen,
    totalLengthM: polylineLength(state.vertices) + segLen,
    angleDeg: segmentAngleDeg(last, state.preview),
  };
}

export function polylineLength(verts: Vec2[]): number {
  let total = 0;
  for (let i = 0; i < verts.length - 1; i++) total += dist(verts[i]!, verts[i + 1]!);
  return total;
}
