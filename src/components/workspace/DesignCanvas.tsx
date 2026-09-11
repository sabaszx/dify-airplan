"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Floor, WallMaterial } from "@/domain/model";
import type { GridResult } from "@/rf/engine";
import { type Viewport, worldToScreen, screenToWorld, clampZoom } from "@/lib/viewport";
import { colorFor, type HeatmapMode } from "@/lib/heatmap-colors";
import { materialColor } from "@/lib/tokens";
import { getProduct } from "@/catalog";
import type { Tool } from "@/store/editor";
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
  type DrawingState,
} from "@/editor/wall-drawing";
import { buildSnapTargets } from "@/editor/snapping";
import { vertexAt, openingWorldPoint } from "@/editor/wall-editing";
import { nearestSnap, pointOnSegment, type SnapTarget, type Vec2 } from "@/geometry";

interface Props {
  floor: Floor;
  materials: WallMaterial[];
  tool: Tool | "opening" | "inspect";
  activeMaterialId: string;
  pinContinuous: boolean;
  selectedIds: string[];
  grid?: GridResult | null;
  heatmapMode: HeatmapMode;
  heatmapOpacity: number;
  showGrid: boolean;
  showApLabels: boolean;
  onSelect: (ids: string[]) => void;
  onPlaceAp: (world: Vec2) => void;
  onCommitWall: (polyline: Vec2[]) => void;
  onCalibrate: (a: Vec2, b: Vec2) => void;
  onMoveApTransient: (apId: string, world: Vec2, commit: boolean) => void;
  onCursor: (world: Vec2 | null) => void;
  onViewport: (vp: Viewport) => void;
  onExitTool: () => void;
  /** Wall editing gestures (wired to command layer in the parent). */
  onMoveWallVertex: (wallId: string, vertexIndex: number, world: Vec2, commit: boolean) => void;
  onTranslateWall: (wallId: string, dx: number, dy: number, commit: boolean) => void;
  onInsertWallVertex: (wallId: string, world: Vec2) => void;
  onRemoveWallVertex: (wallId: string, vertexIndex: number) => void;
  onAddOpening: (wallId: string, world: Vec2) => void;
  /** Object-aware right-click. Provides screen position and world point. */
  onContextMenu: (screen: { x: number; y: number }, world: Vec2) => void;
  /** Double-click an AP opens its editor. */
  onEditAp: (apId: string) => void;
  /** Optional display overrides from the visualization panel. */
  floorPlanOpacity?: number;
  apIconSize?: number;
  /** When false, AP device icons/labels are hidden (layer visibility). Devices
   *  are NOT deleted — only their rendering is suppressed. Default true. */
  showApDevices?: boolean;
  /** Display cutoff (dBm): heatmap cells below this are hidden. Display-only;
   *  does not change simulation values. See override §2. */
  cutoffDbm?: number;
}

export function DesignCanvas(props: Props) {
  const {
    floor,
    tool,
    activeMaterialId,
    selectedIds,
    grid,
    heatmapMode,
    heatmapOpacity,
    showGrid,
    showApLabels,
    onSelect,
    onPlaceAp,
    onCommitWall,
    onCalibrate,
    onMoveApTransient,
    onCursor,
    onViewport,
    onExitTool,
    onMoveWallVertex,
    onTranslateWall,
    onInsertWallVertex,
    onRemoveWallVertex,
    onAddOpening,
    onContextMenu,
    onEditAp,
    floorPlanOpacity,
    apIconSize,
    showApDevices = true,
    cutoffDbm,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ zoom: 1, panX: 40, panY: 40 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [activeSnap, setActiveSnap] = useState<SnapTarget | null>(null);
  const [calStart, setCalStart] = useState<Vec2 | null>(null);
  const [dragApId, setDragApId] = useState<string | null>(null);
  const [dragVertex, setDragVertex] = useState<{ wallId: string; index: number } | null>(null);
  const [dragWall, setDragWall] = useState<{ wallId: string; last: Vec2 } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const panState = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const numericBuffer = useRef<string>("");

  const mpp = floor.plan?.metersPerPixel ?? 0.02;
  const snapRadiusMeters = (8 * mpp) / vp.zoom; // ~8 screen px, consistent across zoom

  useEffect(() => {
    onViewport(vp);
  }, [vp, onViewport]);

  useEffect(() => {
    if (!floor.plan?.imageSrc) return setImg(null);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = floor.plan.imageSrc;
  }, [floor.plan?.imageSrc]);

  // Enter/leave wall drawing mode with the tool.
  useEffect(() => {
    if (tool === "wall") setDrawing((d) => d ?? createDrawingState(activeMaterialId));
    else {
      setDrawing(null);
      setCalStart(null);
    }
  }, [tool, activeMaterialId]);

  // Keep material in sync while drawing.
  useEffect(() => {
    setDrawing((d) => (d ? { ...d, materialId: activeMaterialId } : d));
  }, [activeMaterialId]);

  // Keyboard: space-pan, Escape/Enter/Backspace for drawing, Shift/Alt modifiers, numeric entry.
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        setSpaceDown(true);
        e.preventDefault();
      }
      if (!drawing) return;
      if (e.key === "Shift") setDrawing((d) => (d ? { ...d, angleConstrained: true } : d));
      if (e.key === "Alt") setDrawing((d) => (d ? { ...d, snapEnabled: false } : d));
      if (e.key === "Enter") {
        const res = finishDrawing(drawing);
        if (res.finished) onCommitWall(res.finished);
        setDrawing({ ...drawing });
      }
      if (e.key === "Backspace") {
        removeLastVertex(drawing);
        setDrawing({ ...drawing });
      }
      if (e.key === "Escape") {
        const res = escape(drawing);
        if (res.exited) {
          setDrawing(null);
          onExitTool();
        } else setDrawing({ ...drawing });
      }
      if (/[0-9.]/.test(e.key)) {
        numericBuffer.current += e.key;
      }
      if (e.key === "Enter" && numericBuffer.current) {
        const len = Number(numericBuffer.current);
        numericBuffer.current = "";
        if (len > 0) {
          commitExactLength(drawing, len);
          setDrawing({ ...drawing });
        }
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
      if (e.key === "Shift") setDrawing((d) => (d ? { ...d, angleConstrained: false } : d));
      if (e.key === "Alt") setDrawing((d) => (d ? { ...d, snapEnabled: true } : d));
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [drawing, onCommitWall, onExitTool]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0f1420";
    ctx.fillRect(0, 0, w, h);

    if (img) {
      ctx.globalAlpha = floorPlanOpacity ?? floor.plan?.opacity ?? 1;
      ctx.drawImage(img, vp.panX, vp.panY, img.width * vp.zoom, img.height * vp.zoom);
      ctx.globalAlpha = 1;
    }

    if (grid) {
      ctx.globalAlpha = heatmapOpacity;
      const cell = grid.spec.resolutionM;
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          const res = grid.cells[r * grid.cols + c]!;
          const color = colorFor(heatmapMode, res, cutoffDbm);
          if (!color) continue;
          const p = worldToScreen(
            grid.spec.originM.x + c * cell,
            grid.spec.originM.y + r * cell,
            mpp,
            vp,
          );
          const size = (cell / mpp) * vp.zoom + 1;
          ctx.fillStyle = color;
          ctx.fillRect(p.x, p.y, size, size);
        }
      }
      ctx.globalAlpha = 1;
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(154,167,189,0.14)";
      ctx.lineWidth = 1;
      const step = (1 / mpp) * vp.zoom;
      if (step > 6) {
        for (let x = vp.panX % step; x < w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = vp.panY % step; y < h; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }
    }

    // Existing walls, colored by material.
    for (const wall of floor.walls) {
      ctx.strokeStyle = selectedIds.includes(wall.id) ? "#f0b429" : materialColor(wall.materialId);
      ctx.lineWidth = Math.max(2.5, (wall.thicknessM / mpp) * vp.zoom);
      ctx.lineCap = "round";
      ctx.beginPath();
      wall.polyline.forEach((pt, i) => {
        const p = worldToScreen(pt.x, pt.y, mpp, vp);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      // Vertex handles when selected.
      if (selectedIds.includes(wall.id)) {
        for (const pt of wall.polyline) {
          const p = worldToScreen(pt.x, pt.y, mpp, vp);
          ctx.fillStyle = "#f0b429";
          ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        }
      }
      // Openings as small markers along the wall.
      for (const opening of wall.openings) {
        const wp = openingWorldPoint(wall, opening);
        if (!wp) continue;
        const p = worldToScreen(wp.x, wp.y, mpp, vp);
        ctx.fillStyle = opening.type === "door" ? "#22d3ee" : "#a78bfa";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0f1420";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // In-progress wall drawing with live preview + measurements.
    if (drawing && drawing.vertices.length > 0) {
      ctx.strokeStyle = materialColor(drawing.materialId);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      drawing.vertices.forEach((pt, i) => {
        const p = worldToScreen(pt.x, pt.y, mpp, vp);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      if (drawing.preview) {
        const p = worldToScreen(drawing.preview.x, drawing.preview.y, mpp, vp);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertex dots.
      for (const pt of drawing.vertices) {
        const p = worldToScreen(pt.x, pt.y, mpp, vp);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Live length/angle label near cursor.
      const m = liveMeasure(drawing);
      if (m && drawing.preview) {
        const p = worldToScreen(drawing.preview.x, drawing.preview.y, mpp, vp);
        const text = `${m.segmentLengthM.toFixed(2)} m  ∠${m.angleDeg.toFixed(0)}°  Σ${m.totalLengthM.toFixed(2)} m`;
        ctx.font = "11px ui-monospace, monospace";
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(p.x + 10, p.y - 22, tw + 10, 16);
        ctx.fillStyle = "#e6ebf5";
        ctx.fillText(text, p.x + 15, p.y - 10);
      }
    }

    // Active snap indicator.
    if (activeSnap) {
      const p = worldToScreen(activeSnap.point.x, activeSnap.point.y, mpp, vp);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x - 5, p.y - 5, 10, 10);
    }

    // Access points + directional beam.
    if (showApDevices) {
      for (const ap of floor.accessPoints) {
        const p = worldToScreen(ap.position.x, ap.position.y, mpp, vp);
        const selected = selectedIds.includes(ap.id);
        const directional = ap.antennaOverride ? !ap.antennaOverride.omnidirectional : false;
        if (directional) {
          const bw = ((ap.antennaOverride?.beamwidthDeg ?? 65) * Math.PI) / 180;
          const dir = (ap.rotationDeg * Math.PI) / 180;
          ctx.fillStyle = "rgba(59,130,246,0.18)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.arc(p.x, p.y, 48, dir - bw / 2, dir + bw / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, apIconSize ?? 9, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "#f0b429" : "#3b82f6";
        ctx.fill();
        ctx.strokeStyle = "#0f1420";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (showApLabels) {
          ctx.fillStyle = "#e6ebf5";
          ctx.font = "11px ui-sans-serif, system-ui";
          ctx.fillText(ap.name, p.x + 12, p.y + 4);
        }
      }
    }
  }, [
    img,
    floor,
    vp,
    grid,
    heatmapMode,
    heatmapOpacity,
    showGrid,
    showApLabels,
    selectedIds,
    drawing,
    activeSnap,
    mpp,
    floorPlanOpacity,
    apIconSize,
    showApDevices,
    cutoffDbm,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  function rel(e: React.MouseEvent): Vec2 {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function apAtScreen(sx: number, sy: number): string | null {
    for (let i = floor.accessPoints.length - 1; i >= 0; i--) {
      const ap = floor.accessPoints[i]!;
      const p = worldToScreen(ap.position.x, ap.position.y, mpp, vp);
      if (Math.hypot(p.x - sx, p.y - sy) <= 11) return ap.id;
    }
    return null;
  }

  const hitToleranceM = () => (8 * mpp) / vp.zoom;

  /** Find a selected wall's vertex under the world cursor. */
  function vertexHit(world: Vec2): { wallId: string; index: number } | null {
    for (const wall of floor.walls) {
      if (!selectedIds.includes(wall.id)) continue;
      const idx = vertexAt(wall.polyline, world, hitToleranceM());
      if (idx >= 0) return { wallId: wall.id, index: idx };
    }
    return null;
  }

  /** Find the wall whose polyline is under the world cursor. */
  function wallHit(world: Vec2): string | null {
    for (let i = floor.walls.length - 1; i >= 0; i--) {
      const wall = floor.walls[i]!;
      for (let s = 0; s < wall.polyline.length - 1; s++) {
        const res = pointOnSegment(world, { a: wall.polyline[s]!, b: wall.polyline[s + 1]! });
        if (res.distance <= hitToleranceM() * 1.5) return wall.id;
      }
    }
    return null;
  }

  function currentSnapTargets(worldCursor: Vec2): SnapTarget[] {
    const anchor = drawing?.vertices[drawing.vertices.length - 1];
    return buildSnapTargets(worldCursor, floor.walls, {
      gridStepM: 1,
      includeGrid: showGrid,
      includeAxes: !!anchor,
      axisAnchor: anchor,
    });
  }

  function handleMouseDown(e: React.MouseEvent) {
    const s = rel(e);
    if (spaceDown || tool === "pan" || e.button === 1) {
      panState.current = { x: s.x, y: s.y, panX: vp.panX, panY: vp.panY };
      return;
    }
    if (tool === "select") {
      const world = screenToWorld(s.x, s.y, mpp, vp);
      // 1. Vertex of an already-selected wall (drag to reshape).
      const vh = vertexHit(world);
      if (vh) {
        setDragVertex(vh);
        return;
      }
      // 2. Access point.
      const hit = apAtScreen(s.x, s.y);
      if (hit) {
        onSelect(e.shiftKey ? [...selectedIds, hit] : [hit]);
        setDragApId(hit);
        return;
      }
      // 3. Wall body (select, then drag translates it).
      const wh = wallHit(world);
      if (wh) {
        onSelect(e.shiftKey ? [...selectedIds, wh] : [wh]);
        setDragWall({ wallId: wh, last: world });
        return;
      }
      onSelect([]);
    }
    if (tool === "opening") {
      const world = screenToWorld(s.x, s.y, mpp, vp);
      const wh = wallHit(world);
      if (wh) onAddOpening(wh, world);
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const s = rel(e);
    const world = screenToWorld(s.x, s.y, mpp, vp);
    onCursor(world);

    if (panState.current) {
      setVp((v) => ({
        ...v,
        panX: panState.current!.panX + (s.x - panState.current!.x),
        panY: panState.current!.panY + (s.y - panState.current!.y),
      }));
      return;
    }
    if (dragApId) {
      onMoveApTransient(dragApId, world, false);
      return;
    }
    if (dragVertex) {
      onMoveWallVertex(dragVertex.wallId, dragVertex.index, world, false);
      return;
    }
    if (dragWall) {
      onTranslateWall(dragWall.wallId, world.x - dragWall.last.x, world.y - dragWall.last.y, false);
      setDragWall({ ...dragWall, last: world });
      return;
    }
    if (drawing) {
      const targets = currentSnapTargets(world);
      const resolved = resolvePoint(drawing, world, targets, snapRadiusMeters);
      setActiveSnap(drawing.snapEnabled ? nearestSnap(world, targets, snapRadiusMeters) : null);
      updatePreview(drawing, resolved);
      setDrawing({ ...drawing });
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    const s = rel(e);
    const world = screenToWorld(s.x, s.y, mpp, vp);
    if (panState.current) {
      panState.current = null;
      return;
    }
    if (dragApId) {
      onMoveApTransient(dragApId, world, true);
      setDragApId(null);
      return;
    }
    if (dragVertex) {
      onMoveWallVertex(dragVertex.wallId, dragVertex.index, world, true);
      setDragVertex(null);
      return;
    }
    if (dragWall) {
      onTranslateWall(dragWall.wallId, 0, 0, true); // commit accumulated transient
      setDragWall(null);
      return;
    }
    if (tool === "ap") {
      onPlaceAp(world);
      return;
    }
    if (tool === "scale") {
      if (!calStart) setCalStart(world);
      else {
        onCalibrate(calStart, world);
        setCalStart(null);
      }
      return;
    }
    if (tool === "wall" && drawing) {
      const targets = currentSnapTargets(world);
      const resolved = resolvePoint(drawing, world, targets, snapRadiusMeters);
      const res = addVertex(drawing, resolved);
      if (res.finished) onCommitWall(res.finished);
      setDrawing({ ...drawing });
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (tool === "wall" && drawing) {
      const res = finishDrawing(drawing);
      if (res.finished) onCommitWall(res.finished);
      setDrawing({ ...drawing });
      return;
    }
    if (tool === "select") {
      const s = rel(e);
      const world = screenToWorld(s.x, s.y, mpp, vp);
      // Double-clicking an AP opens its editor.
      const apHit = apAtScreen(s.x, s.y);
      if (apHit) {
        onEditAp(apHit);
        return;
      }
      // Double-click a vertex of a selected wall to remove it; else insert on segment.
      const vh = vertexHit(world);
      if (vh) {
        onRemoveWallVertex(vh.wallId, vh.index);
        return;
      }
      const wh = wallHit(world);
      if (wh && selectedIds.includes(wh)) onInsertWallVertex(wh, world);
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    // Prevent the browser menu only inside the editable canvas.
    e.preventDefault();
    const s = rel(e);
    const world = screenToWorld(s.x, s.y, mpp, vp);
    onContextMenu({ x: e.clientX, y: e.clientY }, world);
  }

  function handleWheel(e: React.WheelEvent) {
    const s = rel(e);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setVp((v) => {
      const z = clampZoom(v.zoom * factor);
      const scale = z / v.zoom;
      return { zoom: z, panX: s.x - (s.x - v.panX) * scale, panY: s.y - (s.y - v.panY) * scale };
    });
  }

  const cursorClass =
    spaceDown || tool === "pan"
      ? "cursor-grab"
      : tool === "select"
        ? "cursor-default"
        : "cursor-crosshair";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* Hidden counters for E2E assertions (aria-hidden; no visual impact). */}
      <span
        data-testid="wall-count"
        data-count={floor.walls.length}
        aria-hidden
        className="sr-only"
      >
        {floor.walls.length}
      </span>
      <span
        data-testid="ap-count"
        data-count={floor.accessPoints.length}
        aria-hidden
        className="sr-only"
      >
        {floor.accessPoints.length}
      </span>
      <canvas
        ref={canvasRef}
        data-testid="design-canvas"
        className={`h-full w-full ${cursorClass}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseLeave={() => onCursor(null)}
        onWheel={handleWheel}
        onKeyDown={(e) => {
          // Shift+F10 or the Context Menu key opens the menu at the last cursor.
          if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
            e.preventDefault();
            const rect = canvasRef.current!.getBoundingClientRect();
            onContextMenu(
              { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
              screenToWorld(rect.width / 2, rect.height / 2, mpp, vp),
            );
          }
        }}
        tabIndex={0}
      />
    </div>
  );
}
