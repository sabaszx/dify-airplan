import { describe, it, expect } from "vitest";
import {
  createDrawingState,
  addVertex,
  updatePreview,
  finishDrawing,
  escape,
  removeLastVertex,
  commitExactLength,
  resolvePoint,
  liveMeasure,
} from "./wall-drawing";
import { buildSnapTargets } from "./snapping";

describe("continuous wall drawing (mandatory acceptance criteria)", () => {
  it("draws a connected sequence of walls without reselecting the tool", () => {
    const s = createDrawingState("concrete");
    addVertex(s, { x: 0, y: 0 });
    addVertex(s, { x: 5, y: 0 });
    addVertex(s, { x: 5, y: 5 });
    expect(s.vertices).toHaveLength(3);
    // Finish; the tool stays active and material is preserved.
    const res = finishDrawing(s);
    expect(res.finished).toHaveLength(3);
    expect(res.exited).toBe(false);
    expect(s.active).toBe(true);
    expect(s.materialId).toBe("concrete");
    // Immediately start another wall with the same tool/material.
    addVertex(s, { x: 10, y: 10 });
    expect(s.vertices).toHaveLength(1);
  });

  it("finishes via finishDrawing (double-click / Enter) producing the polyline", () => {
    const s = createDrawingState("drywall");
    addVertex(s, { x: 0, y: 0 });
    addVertex(s, { x: 3, y: 0 });
    const res = finishDrawing(s);
    expect(res.finished).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("closes the polyline when clicking near the start", () => {
    const s = createDrawingState("glass");
    addVertex(s, { x: 0, y: 0 });
    addVertex(s, { x: 5, y: 0 });
    addVertex(s, { x: 5, y: 5 });
    const res = addVertex(s, { x: 0.05, y: 0.05 }); // near start
    expect(res.finished).not.toBeNull();
    expect(res.finished!.length).toBe(4); // closed ring
  });

  it("Escape cancels the current segment then exits on the second press", () => {
    const s = createDrawingState("brick");
    addVertex(s, { x: 0, y: 0 });
    addVertex(s, { x: 5, y: 0 });
    const first = escape(s);
    expect(first.exited).toBe(false);
    expect(s.vertices).toHaveLength(0);
    const second = escape(s);
    expect(second.exited).toBe(true);
    expect(s.active).toBe(false);
  });

  it("Backspace removes the most recent uncommitted vertex", () => {
    const s = createDrawingState("wood");
    addVertex(s, { x: 0, y: 0 });
    addVertex(s, { x: 5, y: 0 });
    removeLastVertex(s);
    expect(s.vertices).toEqual([{ x: 0, y: 0 }]);
  });

  it("numeric entry commits an exact segment length", () => {
    const s = createDrawingState("metal");
    addVertex(s, { x: 0, y: 0 });
    updatePreview(s, { x: 1, y: 0 }); // direction +X
    commitExactLength(s, 7);
    expect(s.vertices[1]!.x).toBeCloseTo(7, 6);
    expect(s.vertices[1]!.y).toBeCloseTo(0, 6);
  });

  it("Shift constrains the angle to 15-degree steps", () => {
    const s = createDrawingState("concrete");
    s.angleConstrained = true;
    addVertex(s, { x: 0, y: 0 });
    const p = resolvePoint(s, { x: 10, y: 0.3 }, [], 0.3);
    expect(p.y).toBeCloseTo(0, 3); // snapped to horizontal
  });

  it("Alt disables snapping", () => {
    const s = createDrawingState("concrete");
    s.snapEnabled = false;
    addVertex(s, { x: 0, y: 0 });
    const targets = buildSnapTargets(
      { x: 5.05, y: 0 },
      [
        {
          id: "w",
          polyline: [
            { x: 5, y: 0 },
            { x: 5, y: 5 },
          ],
        },
      ],
      {
        gridStepM: 1,
        includeGrid: true,
        includeAxes: false,
      },
    );
    const p = resolvePoint(s, { x: 5.05, y: 0 }, targets, 0.2);
    expect(p).toEqual({ x: 5.05, y: 0 }); // unchanged, no snap
  });

  it("snaps a vertex exactly onto an existing wall endpoint when nearest", () => {
    const s = createDrawingState("concrete");
    // Cursor closest to the endpoint (5,0): below and right of it so the
    // endpoint is the nearest candidate.
    const targets = buildSnapTargets(
      { x: 5.03, y: -0.03 },
      [
        {
          id: "w",
          polyline: [
            { x: 5, y: 0 },
            { x: 5, y: 5 },
          ],
        },
      ],
      {
        gridStepM: 1,
        includeGrid: false,
        includeAxes: false,
      },
    );
    const p = resolvePoint(s, { x: 5.03, y: -0.03 }, targets, 0.2);
    expect(p).toEqual({ x: 5, y: 0 });
  });

  it("snaps onto a wall segment when the projection is nearest", () => {
    const s = createDrawingState("concrete");
    const targets = buildSnapTargets(
      { x: 5.05, y: 2.5 },
      [
        {
          id: "w",
          polyline: [
            { x: 5, y: 0 },
            { x: 5, y: 5 },
          ],
        },
      ],
      {
        gridStepM: 1,
        includeGrid: false,
        includeAxes: false,
      },
    );
    const p = resolvePoint(s, { x: 5.05, y: 2.5 }, targets, 0.2);
    expect(p).toEqual({ x: 5, y: 2.5 });
  });

  it("reports live segment length, total length, and angle", () => {
    const s = createDrawingState("concrete");
    addVertex(s, { x: 0, y: 0 });
    addVertex(s, { x: 3, y: 0 });
    updatePreview(s, { x: 3, y: 4 });
    const m = liveMeasure(s)!;
    expect(m.segmentLengthM).toBeCloseTo(4, 6);
    expect(m.totalLengthM).toBeCloseTo(7, 6);
    expect(m.angleDeg).toBeCloseTo(90, 3);
  });
});
