---
inclusion: auto
name: canvas-editor
description: Apply when creating or modifying canvas rendering, geometry, walls, snapping, openings, object selection, hit-testing, or context menus.
---

# Canvas editor guidance

- Keep pure editor logic in `src/editor/` (wall-drawing, wall-editing, snapping,
  hit-test, context-menu definitions) and `src/geometry/`. Rendering-only code
  lives in `components/workspace/DesignCanvas.tsx`.
- All coordinates are world meters; convert with `lib/viewport.ts`.
- Every mutation goes through the editor store as a Command; coalesce drags via
  begin/commit transient so a drag produces one undo entry.
- Snap radius must be zoom-consistent (compute in meters from screen pixels).
- Right-click uses `hitTest` to find the topmost object and opens `menuForKind`;
  select the object before opening; offer Select Behind/From List on overlap.
- `preventDefault` only inside the canvas; never disable the native browser menu
  outside the editable canvas.
- Add unit tests in `src/editor/*.test.ts` and `src/geometry/*.test.ts` for new
  geometry/interaction logic.

Reference: `src/editor/hit-test.ts`, `src/editor/context-menu.ts`,
`src/editor/wall-drawing.ts`, `src/geometry/index.ts`.
