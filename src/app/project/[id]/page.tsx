"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { localProjectStore } from "@/lib/storage";
import { loadValidatedProject } from "@/lib/load-project";
import { useEditor, activeScenario, activeFloor, type Tool } from "@/store/editor";
import { createAccessPoint, createScenario, createFloor, uid } from "@/domain/factory";
import type { AccessPoint, Wall } from "@/domain/model";
import type { ApInput, WallInput, GridResult, GridSpec } from "@/rf/engine";
import { DEFAULT_ENGINE_CONFIG, computePoint } from "@/rf/engine";
import type { Band } from "@/rf/pathloss";
import { runSimulation } from "@/workers/client";
import { DesignCanvas } from "@/components/workspace/DesignCanvas";
import { ApLibrary } from "@/components/workspace/ApLibrary";
import { ApProperties } from "@/components/workspace/ApProperties";
import { WallProperties } from "@/components/workspace/WallProperties";
import { MaterialLibraryPanel } from "@/components/workspace/MaterialLibraryPanel";
import { HierarchyPanel, type HierarchyActions } from "@/components/workspace/HierarchyPanel";
import { LayerPanel } from "@/components/workspace/LayerPanel";
import { View3D } from "@/components/workspace/View3D";
import {
  type LayerVisibility,
  DEFAULT_LAYER_VISIBILITY,
  loadLayerVisibility,
  saveLayerVisibility,
  showsDevices,
  showsAnalysis,
} from "@/lib/layer-visibility";
import {
  addFloor as hAddFloor,
  archiveFloor as hArchiveFloor,
  restoreFloor as hRestoreFloor,
  deleteFloor as hDeleteFloor,
  reorderFloors as hReorderFloors,
  addBuilding as hAddBuilding,
  orderedFloors,
} from "@/domain/hierarchy";
import { PatternImportPanel } from "@/components/antenna/PatternImportPanel";
import { NavRail, type Workspace } from "@/components/shell/NavRail";
import { BottomToolbar } from "@/components/shell/BottomToolbar";
import { Inspector } from "@/components/shell/Inspector";
import { legendFor, type HeatmapMode } from "@/lib/heatmap-colors";
import type { Viewport } from "@/lib/viewport";
import { metersPerPixel as computeMpp } from "@/lib/units";
import { materialColor } from "@/lib/tokens";
import { getProduct } from "@/catalog";
import { getDomain, allowedChannels } from "@/regulatory/domains";
import { planChannels } from "@/rf/channel";
import { estimateZone } from "@/rf/capacity";
import { allScenarioSummaries, scenarioBom } from "@/lib/scenario-metrics";
import {
  apInventoryCsv,
  bomCsv,
  projectJson,
  placementJson,
  reportHtml,
  downloadText,
} from "@/lib/export";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import type { Vec2 } from "@/geometry";
import { insertVertexNear, removeVertex, attachOpeningAt, wallPieces } from "@/editor/wall-editing";
import { setPalette, type Palette } from "@/lib/heatmap-colors";
import { VisualizationPanel, type VizSettings } from "@/components/workspace/VisualizationPanel";
import { ModeTabs } from "@/components/workspace/ModeTabs";
import { SignalLegend } from "@/components/workspace/SignalLegend";
import { hitTest, topHit, type Hit } from "@/editor/hit-test";
import { menuForKind, type MenuItem } from "@/editor/context-menu";
import { ContextMenu } from "@/components/shell/ContextMenu";
import { ModelSelector } from "@/components/workspace/ModelSelector";
import { ModelChangeSummary } from "@/components/workspace/ModelChangeSummary";
import {
  computeModelChange,
  applyModelChange,
  type CompatibilitySummary,
} from "@/domain/model-change";
import type { ApEditorTab } from "@/components/workspace/ApProperties";
import { nowIso } from "@/domain/factory";

const RES_MODES = { draft: 1.0, standard: 0.5, high: 0.25 } as const;
const HEATMAP_MODES: HeatmapMode[] = [
  "rssi",
  "snr",
  "primary-coverage",
  "secondary-coverage",
  "overlap",
  "channel",
  "co-channel",
  "phy-rate",
  "throughput",
  "capacity",
  "coverage-pass",
];
type ToolId = Tool | "opening" | "inspect";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const {
    project,
    saveStatus,
    activeTool,
    activeFloorId,
    selectedIds,
    loadProject,
    setTool,
    setActiveFloor,
    setSelection,
    update,
    undo,
    redo,
  } = useEditor();
  const { push } = useToast();
  const { confirm, dialog } = useConfirm();

  const [workspace, setWorkspace] = useState<Workspace>("design");
  const [toolId, setToolId] = useState<ToolId>("select");
  const [pinContinuous, setPinContinuous] = useState(true);
  const [activeMaterialId, setActiveMaterialId] = useState("concrete");
  const [band, setBand] = useState<Band>("5");
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("rssi");
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.55);
  const [resMode, setResMode] = useState<keyof typeof RES_MODES>("standard");
  const [showGrid, setShowGrid] = useState(true);
  const [showApLabels, setShowApLabels] = useState(true);
  const [overlayOff, setOverlayOff] = useState(false);
  const [palette, setPaletteState] = useState<Palette>("coverage");
  const [wallOpacity, setWallOpacity] = useState(1);
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.9);
  const [iconSize, setIconSize] = useState(9);
  const [showChannels, setShowChannels] = useState(false);
  const [grid, setGrid] = useState<GridResult | null>(null);
  const [simProgress, setSimProgress] = useState<number | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [inspect, setInspect] = useState<ReturnType<typeof computePoint> | null>(null);
  const vpRef = useRef<Viewport>({ zoom: 1, panX: 40, panY: 40 });
  const cancelRef = useRef<() => void>(() => {});
  const [apEditorTab, setApEditorTab] = useState<ApEditorTab>("properties");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
    hit: Hit;
    world: Vec2;
  } | null>(null);
  const [modelSelectorFor, setModelSelectorFor] = useState<string | null>(null);
  const [modelChange, setModelChange] = useState<{
    apId: string;
    productId: string;
    fromModel: string;
    toModel: string;
    summary: CompatibilitySummary;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wallAlignment, setWallAlignment] = useState<"center" | "left" | "right">("center");
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [viewMode, setViewMode] = useState<"2d" | "3d" | "split">("2d");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadValidatedProject(id);
      if (cancelled) return;
      if (res.ok) {
        loadProject(res.project);
        setLoadError(null);
      } else {
        setLoadError(
          res.reason === "not-found"
            ? "This project was not found. It may have been deleted."
            : "This project could not be opened: its stored data is invalid or from an unsupported version.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadProject]);

  // Apply the default heatmap palette on mount.
  useEffect(() => {
    setPalette(palette);
  }, [palette]);

  // Load persisted per-view layer visibility on mount.
  useEffect(() => {
    setLayerVisibility(loadLayerVisibility());
  }, []);

  function updateLayerVisibility(next: LayerVisibility) {
    setLayerVisibility(next);
    saveLayerVisibility(next);
  }

  // Sync tool selection into the store's Tool enum (drawing tools).
  useEffect(() => {
    if (["select", "pan", "scale", "wall", "area", "annotate", "ap", "measure"].includes(toolId)) {
      setTool(toolId as Tool);
    }
  }, [toolId, setTool]);

  // Keyboard shortcuts (global).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      const map: Record<string, ToolId> = {
        v: "select",
        h: "pan",
        k: "scale",
        m: "measure",
        w: "wall",
        r: "area",
        z: "annotate",
        a: "ap",
        i: "inspect",
      };
      if (map[e.key.toLowerCase()] && !meta) setToolId(map[e.key.toLowerCase()]!);
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length && tag !== "INPUT") {
        deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, undo, redo]);

  const engineAps = useCallback((): ApInput[] => {
    if (!project) return [];
    const f = activeFloor(project, activeFloorId);
    if (!f) return [];
    const domain = getDomain(project.regulatoryDomain);
    return f.accessPoints.map((ap) => {
      const product = getProduct(ap.productId);
      return {
        id: ap.id,
        position: ap.position,
        mountingHeightM: ap.mountingHeightM,
        radios: ap.radios.map((r) => ({
          band: r.band,
          enabled: r.enabled,
          txPowerDbm: r.txPowerDbm,
          channel: r.channel,
          channelCenterMHz:
            r.channel > 0
              ? allowedChannels(domain, r.band, project.allowDfs).find(
                  (c) => c.channel === r.channel,
                )?.centerMHz
              : undefined,
          channelWidthMHz: r.channelWidthMHz,
          spatialStreams: r.spatialStreams,
          antenna: {
            gainDbi: r.antennaGainDbi,
            omnidirectional: ap.antennaOverride ? ap.antennaOverride.omnidirectional : true,
            boresightDeg: ap.rotationDeg,
            beamwidthDeg: product?.antenna.beamwidthDeg,
          },
        })),
      };
    });
  }, [project, activeFloorId]);

  const engineWalls = useCallback((): WallInput[] => {
    if (!project) return [];
    const f = activeFloor(project, activeFloorId);
    if (!f) return [];
    return f.walls.map((w) => {
      const mat = project.materials.find((m) => m.id === w.materialId);
      const attenuationDb = mat?.attenuationDb ?? { "2.4": 5, "5": 7, "6": 9 };
      return {
        polyline: w.polyline,
        attenuationDb,
        thicknessM: w.thicknessM,
        // Split into pieces when the wall has openings so RF applies the
        // opening's own (lower) attenuation across its span.
        pieces: w.openings.length > 0 ? wallPieces(w, attenuationDb) : undefined,
        // Pass the full material + alignment so thickness-dependent attenuation
        // models use the in-material path length. Fixed models remain once-per-crossing.
        material: mat,
        alignment: wallAlignment,
      };
    });
  }, [project, activeFloorId, wallAlignment]);

  // Point inspector on hover.
  useEffect(() => {
    if (!cursor || !project) return setInspect(null);
    setInspect(computePoint(cursor, band, engineAps(), engineWalls(), DEFAULT_ENGINE_CONFIG));
  }, [cursor, band, project, engineAps, engineWalls]);

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center text-base-muted">
        <p className="max-w-md">{loadError}</p>
        <Link href="/" className="btn">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center text-base-muted">
        Loading project…
      </div>
    );
  }

  const scn = activeScenario(project);
  const floor = activeFloor(project, activeFloorId);
  const selectedAp = floor?.accessPoints.find((a) => a.id === selectedIds[0]) ?? null;
  const selectedWalls = floor?.walls.filter((w) => selectedIds.includes(w.id)) ?? [];
  const selectedWall = selectedWalls[0] ?? null;

  function floorExtentMeters(): { w: number; h: number } {
    const mpp = floor?.plan?.metersPerPixel ?? 0.02;
    return { w: (floor?.plan?.widthPx ?? 1200) * mpp, h: (floor?.plan?.heightPx ?? 800) * mpp };
  }

  async function simulate() {
    if (!floor) return;
    const { w, h } = floorExtentMeters();
    const spec: GridSpec = {
      originM: { x: 0, y: 0 },
      widthM: w,
      heightM: h,
      resolutionM: RES_MODES[resMode],
    };
    setSimProgress(0);
    const handle = runSimulation({
      spec,
      band,
      aps: engineAps(),
      walls: engineWalls(),
      config: DEFAULT_ENGINE_CONFIG,
      onProgress: (f) => setSimProgress(f),
    });
    cancelRef.current = handle.cancel;
    try {
      setGrid(await handle.promise);
      push("Simulation complete", "success");
    } catch {
      push("Simulation cancelled");
    } finally {
      setSimProgress(null);
    }
  }

  function placeAp(world: Vec2) {
    if (!floor) return;
    const productId = selectedAp?.productId ?? "cat9166";
    const ap = createAccessPoint(productId, world, `AP-${floor.accessPoints.length + 1}`);
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      f?.accessPoints.push(ap);
    });
    setSelection([ap.id]);
    setGrid(null);
    if (!pinContinuous) setToolId("select");
  }

  function commitWall(polyline: Vec2[]) {
    if (!floor) return;
    const wall: Wall = {
      id: uid("wall"),
      polyline,
      materialId: activeMaterialId,
      thicknessM: 0.15,
      heightM: 2.7,
      bottomElevationM: 0,
      openings: [],
    };
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      f?.walls.push(wall);
    });
    setGrid(null);
    push(`Wall added (${activeMaterialId})`, "success");
  }

  function calibrate(a: Vec2, b: Vec2) {
    if (!floor) return;
    const mpp = floor.plan?.metersPerPixel ?? 0.02;
    const pixelLen = Math.hypot((b.x - a.x) / mpp, (b.y - a.y) / mpp);
    const input = window.prompt("Real-world length of the drawn line (meters):", "10");
    if (!input) return;
    const real = Number(input);
    if (real > 0 && pixelLen > 0) {
      const newMpp = computeMpp(pixelLen, real, "m");
      update((p) => {
        const f = activeScenario(p).floors.find((x) => x.id === floor.id);
        if (f?.plan) f.plan.metersPerPixel = newMpp;
      });
      push(`Scale set: ${newMpp.toFixed(4)} m/px`, "success");
    }
  }

  function moveApTransient(apId: string, world: Vec2, commit: boolean) {
    update(
      (p) => {
        const f = activeScenario(p).floors.find((x) => x.id === floor?.id);
        const ap = f?.accessPoints.find((a) => a.id === apId);
        if (ap) ap.position = world;
      },
      { transient: !commit },
    );
    if (commit) setGrid(null);
  }

  // ---- wall editing gestures ----
  function moveWallVertex(wallId: string, index: number, world: Vec2, commit: boolean) {
    update(
      (p) => {
        const w = activeScenario(p)
          .floors.find((x) => x.id === floor?.id)
          ?.walls.find((x) => x.id === wallId);
        if (w && w.polyline[index]) w.polyline[index] = { x: world.x, y: world.y };
      },
      { transient: !commit },
    );
    if (commit) setGrid(null);
  }

  function translateWall(wallId: string, dx: number, dy: number, commit: boolean) {
    if (dx !== 0 || dy !== 0) {
      update(
        (p) => {
          const w = activeScenario(p)
            .floors.find((x) => x.id === floor?.id)
            ?.walls.find((x) => x.id === wallId);
          if (w) w.polyline = w.polyline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
        },
        { transient: !commit },
      );
    }
    if (commit) setGrid(null);
  }

  function insertWallVertex(wallId: string, world: Vec2) {
    update((p) => {
      const w = activeScenario(p)
        .floors.find((x) => x.id === floor?.id)
        ?.walls.find((x) => x.id === wallId);
      if (!w) return;
      const res = insertVertexNear(w.polyline, world, 0.5);
      if (res) w.polyline = res.polyline;
    });
    setGrid(null);
  }

  function removeWallVertex(wallId: string, index: number) {
    update((p) => {
      const w = activeScenario(p)
        .floors.find((x) => x.id === floor?.id)
        ?.walls.find((x) => x.id === wallId);
      if (w) w.polyline = removeVertex(w.polyline, index);
    });
    setGrid(null);
  }

  function addOpening(wallId: string, world: Vec2) {
    update((p) => {
      const w = activeScenario(p)
        .floors.find((x) => x.id === floor?.id)
        ?.walls.find((x) => x.id === wallId);
      if (!w) return;
      const opening = attachOpeningAt(w, world, (segmentIndex, t) => ({
        id: uid("open"),
        type: "door",
        segmentIndex,
        t,
        widthM: 0.9,
        heightM: 2.1,
        bottomElevationM: 0,
        open: false,
        attenuationDb: { "2.4": 2, "5": 3, "6": 3 },
      }));
      if (opening) w.openings.push(opening);
    });
    setGrid(null);
    push("Opening added to wall", "success");
  }

  function updateSelectedAp(mutate: (ap: AccessPoint) => void) {
    if (!selectedAp) return;
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor?.id);
      const ap = f?.accessPoints.find((a) => a.id === selectedAp.id);
      if (ap) mutate(ap);
    });
    setGrid(null);
  }

  function deleteSelected() {
    if (!floor || selectedIds.length === 0) return;
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      if (f) {
        f.accessPoints = f.accessPoints.filter((a) => !selectedIds.includes(a.id));
        f.walls = f.walls.filter((w) => !selectedIds.includes(w.id));
      }
    });
    setSelection([]);
    setGrid(null);
  }

  // ---- context menu (object-aware) ----
  function handleContextMenu(screen: { x: number; y: number }, world: Vec2) {
    if (!floor) return;
    const mpp = floor.plan?.metersPerPixel ?? 0.02;
    const tol = (10 * mpp) / vpRef.current.zoom;
    const hits = hitTest(floor, world, tol);
    const top = topHit(floor, world, tol);
    // Select the object under the pointer before opening the menu.
    if (top.kind === "access-point") setSelection([top.id]);
    else if (top.kind === "wall" || top.kind === "wall-vertex") {
      const wallId = top.kind === "wall" ? top.id : (top.extra?.wallId ?? top.id);
      setSelection([wallId]);
    } else setSelection([]);

    const overlap =
      hits.filter((h) => h.kind !== "background" && h.kind !== "empty").length > 1
        ? hits
            .filter((h) => h.kind !== "background" && h.kind !== "empty")
            .map((h) => ({ actionId: `pick:${h.kind}:${h.id}`, label: `${h.kind}: ${h.label}` }))
        : undefined;
    const items = menuForKind(top.kind, { overlap });
    setMenu({ x: screen.x, y: screen.y, items, hit: top, world });
  }

  function handleMenuAction(actionId: string) {
    const hit = menu?.hit;
    const world = menu?.world;
    setMenu(null);
    if (!hit) return;

    // Overlap picker: "pick:<kind>:<id>"
    if (actionId.startsWith("pick:")) {
      const [, , objId] = actionId.split(":");
      if (objId) setSelection([objId]);
      return;
    }

    switch (actionId) {
      // Access point
      case "ap.edit":
        openApEditor(hit.id, "properties");
        break;
      case "ap.changeModel":
        setModelSelectorFor(hit.id);
        break;
      case "ap.configureRadios":
        openApEditor(hit.id, "radios");
        break;
      case "ap.changeAntenna":
      case "ap.viewPattern":
        openApEditor(hit.id, "pattern");
        break;
      case "ap.duplicate":
        setSelection([hit.id]);
        duplicateSelected();
        break;
      case "ap.delete":
        setSelection([hit.id]);
        deleteSelected();
        break;
      case "ap.viewDatasheet": {
        const ap = floor?.accessPoints.find((a) => a.id === hit.id);
        const url = ap && getProduct(ap.productId)?.datasheetUrl;
        if (url) window.open(url, "_blank");
        break;
      }
      case "ap.rotate":
        setSelection([hit.id]);
        openApEditor(hit.id, "properties");
        break;
      // Wall
      case "wall.edit":
      case "wall.changeMaterial":
        setSelection([hit.id]);
        setWorkspace("design");
        break;
      case "wall.insertVertex":
        if (world) insertWallVertex(hit.id, world);
        break;
      case "wall.addDoor":
        if (world) addOpening(hit.id, world);
        break;
      case "wall.delete":
        setSelection([hit.id]);
        deleteSelected();
        break;
      // Background
      case "bg.calibrate":
        setToolId("scale");
        break;
      case "bg.fit":
        break;
      // Empty canvas
      case "canvas.addAp":
        if (world) placeAp(world);
        break;
      case "canvas.startWall":
        setToolId("wall");
        break;
      default:
        break;
    }
  }

  function openApEditor(apId: string, tab: ApEditorTab) {
    setSelection([apId]);
    setApEditorTab(tab);
    setWorkspace("design"); // inspector shows AP properties when an AP is selected
  }

  // ---- model change flow ----
  function beginModelChange(apId: string, newProductId: string) {
    const ap = floor?.accessPoints.find((a) => a.id === apId);
    const next = getProduct(newProductId);
    if (!ap || !next) return;
    if (newProductId === ap.productId) {
      setModelSelectorFor(null);
      return;
    }
    const summary = computeModelChange(ap, getProduct(ap.productId), next);
    setModelSelectorFor(null);
    setModelChange({
      apId,
      productId: newProductId,
      fromModel: getProduct(ap.productId)?.model ?? ap.productId,
      toModel: next.model,
      summary,
    });
  }

  function confirmModelChange() {
    if (!modelChange) return;
    const next = getProduct(modelChange.productId);
    if (!next) return;
    // One undoable command.
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor?.id);
      const ap = f?.accessPoints.find((a) => a.id === modelChange.apId);
      if (ap) applyModelChange(ap, next, nowIso());
    });
    setModelChange(null);
    setGrid(null);
    setApEditorTab("properties");
    push(`Model changed to ${modelChange.toModel}`, "success");
  }

  function applyPatternToSelectedAp(p: import("@/antenna/schema").AntennaPattern) {
    if (!selectedAp) {
      push("Select an AP first to assign the pattern.", "info");
      return;
    }
    const name = selectedAp.name;
    updateSelectedAp((ap) => {
      ap.antennaOverride = {
        omnidirectional: p.antenna.type === "omnidirectional",
        beamwidthDeg: p.patterns[0]?.beamwidthDeg,
        gainDbi: p.patterns[0]?.peakGainDbi ?? 4,
      };
    });
    push(`Pattern applied to ${name}`, "success");
  }

  function replaceSelectedAp(newProductId: string) {
    if (!floor || !selectedAp) return;
    const template = createAccessPoint(newProductId, selectedAp.position, selectedAp.name);
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      const ap = f?.accessPoints.find((a) => a.id === selectedAp.id);
      if (!ap) return;
      // Preserve location, name, mounting, and asset metadata; adopt new model's radios.
      ap.productId = newProductId;
      ap.radios = template.radios;
      ap.mountingType = ap.mountingType;
    });
    setGrid(null);
    setWorkspace("design");
    push(`Replaced model, kept location`, "success");
  }

  function updateWall(mutate: (w: Wall) => void, opts?: { bulk?: boolean }) {
    if (!floor) return;
    const ids = opts?.bulk ? selectedIds : selectedWall ? [selectedWall.id] : [];
    if (ids.length === 0) return;
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      if (!f) return;
      for (const w of f.walls) {
        if (ids.includes(w.id)) mutate(w);
      }
    });
    setGrid(null);
  }

  function duplicateSelectedWall() {
    if (!floor || !selectedWall) return;
    const copy: Wall = {
      ...JSON.parse(JSON.stringify(selectedWall)),
      id: uid("wall"),
      polyline: selectedWall.polyline.map((pt) => ({ x: pt.x + 1, y: pt.y + 1 })),
    };
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      f?.walls.push(copy);
    });
    setSelection([copy.id]);
    setGrid(null);
  }

  // ---- floor hierarchy actions (immutable ops via the command store) ----
  const hierarchyActions: HierarchyActions = {
    onOpenFloor: (floorId) => setActiveFloor(floorId),
    onAddFloor: (buildingId, position) =>
      update((p) => {
        const s = activeScenario(p);
        Object.assign(s, hAddFloor(s, { buildingId, position }));
      }),
    onAddFloorRelative: (floorId, position) =>
      update((p) => {
        const s = activeScenario(p);
        Object.assign(s, hAddFloor(s, { relativeToFloorId: floorId, position }));
      }),
    onDuplicateFloor: (floorId) =>
      update((p) => {
        const s = activeScenario(p);
        Object.assign(s, hAddFloor(s, { duplicateFromFloorId: floorId }));
      }),
    onRenameFloor: (floorId, name) =>
      update((p) => {
        const f = activeScenario(p).floors.find((x) => x.id === floorId);
        if (f) f.name = name;
      }),
    onArchiveFloor: (floorId) =>
      update((p) => {
        const s = activeScenario(p);
        Object.assign(s, hArchiveFloor(s, floorId));
      }),
    onRestoreFloor: (floorId) =>
      update((p) => {
        const s = activeScenario(p);
        Object.assign(s, hRestoreFloor(s, floorId));
      }),
    onDeleteFloor: (floorId) => {
      const target = scn.floors.find((f) => f.id === floorId);
      // Report references would come from stored report snapshots; none in the
      // client MVP, so pass an empty referenced list. Confirm destructive op.
      confirm(
        `Delete floor "${target?.name ?? floorId}"? This cannot be undone. Archive keeps it recoverable.`,
      ).then((ok) => {
        if (!ok) return;
        let failure: string | null = null;
        update((p) => {
          const s = activeScenario(p);
          const res = hDeleteFloor(s, floorId, []);
          if (res.ok) Object.assign(s, res.scenario);
          else failure = res.reason;
        });
        if (failure === "last-floor")
          push("Cannot delete the only floor. Add another first.", "error");
        else if (failure === "referenced")
          push("Floor is referenced by a report; archive it instead.", "error");
        else {
          if (activeFloorId === floorId) {
            const next = orderedFloors(scn).find((f) => f.id !== floorId);
            if (next) setActiveFloor(next.id);
          }
          push("Floor deleted");
        }
      });
    },
    onReorderFloor: (floorId, direction) =>
      update((p) => {
        const s = activeScenario(p);
        const ids = orderedFloors(s).map((f) => f.id);
        const i = ids.indexOf(floorId);
        const j = direction === "up" ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j]!, ids[i]!];
        Object.assign(s, hReorderFloors(s, ids));
      }),
    onAddBuilding: () =>
      update((p) => {
        const s = activeScenario(p);
        Object.assign(s, hAddBuilding(s, `Building ${s.buildings.length + 1}`));
      }),
  };

  function duplicateSelected() {
    if (!floor || !selectedAp) return;
    const copy = createAccessPoint(selectedAp.productId, {
      x: selectedAp.position.x + 2,
      y: selectedAp.position.y + 2,
    });
    copy.radios = JSON.parse(JSON.stringify(selectedAp.radios));
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      f?.accessPoints.push(copy);
    });
    setSelection([copy.id]);
  }

  async function handleUpload(file: File) {
    if (!floor) return;
    const okTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!okTypes.includes(file.type)) return push("Unsupported file type (PNG/JPEG/SVG).", "error");
    if (file.size > 15 * 1024 * 1024) return push("File too large (max 15 MB).", "error");
    const dataUrl = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(file);
    });
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const im = new Image();
      im.onload = () => res({ w: im.width, h: im.height });
      im.src = dataUrl;
    });
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      if (f)
        f.plan = {
          id: uid("plan"),
          fileName: file.name.replace(/[^\w.\- ]/g, "_"),
          imageSrc: dataUrl,
          widthPx: dims.w,
          heightPx: dims.h,
          metersPerPixel: 0.02,
          locked: false,
          opacity: 1,
        };
    });
    push("Floor plan uploaded. Calibrate the scale next.", "success");
  }

  function runChannelPlan() {
    if (!project) return;
    const domain = getDomain(project.regulatoryDomain);
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor?.id);
      if (!f) return;
      for (const b of ["2.4", "5", "6"] as Band[]) {
        const allowed = allowedChannels(domain, b, p.allowDfs);
        if (allowed.length === 0) continue;
        const apsForBand = engineAps().filter((a) =>
          a.radios.some((r) => r.band === b && r.enabled),
        );
        for (const asg of planChannels(b, apsForBand, allowed)) {
          const radio = f.accessPoints
            .find((a) => a.id === asg.apId)
            ?.radios.find((r) => r.band === b);
          if (radio) {
            radio.channel = asg.channel;
            radio.channelAuto = false;
          }
        }
      }
    });
    push("Channel plan applied", "success");
    setGrid(null);
  }

  const legend = legendFor(heatmapMode);

  // Inspector content by selection / workspace.
  function inspectorTitle(): string {
    if (workspace === "catalog") return "Product catalog";
    if (selectedAp) return "Access point";
    if (selectedWall) return selectedWalls.length > 1 ? "Walls" : "Wall";
    if (workspace === "analysis") return "Heatmap & analysis";
    if (workspace === "requirements") return "Requirements & capacity";
    if (workspace === "inventory" || workspace === "reports") return "Scenarios, inventory & BOM";
    if (workspace === "settings") return "Settings, materials & patterns";
    if (workspace === "floorplans" || workspace === "overview") return "Network hierarchy";
    return "Floor & visualization";
  }

  function inspectorBody() {
    if (workspace === "catalog") {
      return (
        <ApLibrary
          onPlace={(pid) => placeApFromCatalog(pid)}
          onReplaceSelected={(pid) => replaceSelectedAp(pid)}
          hasSelection={!!selectedAp}
        />
      );
    }
    if (selectedAp) {
      return (
        <ApProperties
          ap={selectedAp}
          regulatoryDomain={project!.regulatoryDomain}
          allowDfs={project!.allowDfs}
          onChange={updateSelectedAp}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onChangeModel={() => setModelSelectorFor(selectedAp!.id)}
          defaultTab={apEditorTab}
        />
      );
    }
    if (selectedWall) {
      return (
        <WallProperties
          wall={selectedWall}
          selectedWalls={selectedWalls}
          materials={project!.materials}
          unit="mm"
          onChange={updateWall}
          alignment={wallAlignment}
          onChangeAlignment={setWallAlignment}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelectedWall}
        />
      );
    }
    if (workspace === "analysis") {
      return (
        <AnalysisPanel
          legend={legend}
          heatmapMode={heatmapMode}
          setHeatmapMode={setHeatmapMode}
          opacity={heatmapOpacity}
          setOpacity={setHeatmapOpacity}
        />
      );
    }
    if (workspace === "requirements") {
      return (
        <CapacityPanel
          servingApCount={floor?.accessPoints.length ?? 0}
          onPlan={runChannelPlan}
          project={project!}
        />
      );
    }
    if (workspace === "settings") {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-base-muted">
              Material library
            </h3>
            <MaterialLibraryPanel
              materials={project!.materials}
              onSave={(mats) => update((p) => (p.materials = mats))}
            />
          </div>
          <div className="border-t border-base-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase text-base-muted">
              Antenna pattern import
            </h3>
            <PatternImportPanel onSave={(p) => applyPatternToSelectedAp(p)} />
            <p className="mt-2 text-[10px] text-base-muted">
              Save assigns the pattern&apos;s directional characteristics to the selected AP. Full
              per-radio pattern storage is available in the data model for future catalog entries.
            </p>
          </div>
        </div>
      );
    }
    if (workspace === "inventory" || workspace === "reports") {
      return (
        <ScenarioInventoryPanel
          project={project!}
          onClone={() =>
            update((p) =>
              p.scenarios.push(
                createScenario(
                  `${activeScenario(p).name} (copy)`,
                  JSON.parse(JSON.stringify(activeScenario(p).floors)),
                ),
              ),
            )
          }
          onPromote={(sid) =>
            update((p) => p.scenarios.forEach((s) => (s.isBaseline = s.id === sid)))
          }
          onSwitch={(sid) => {
            update((p) => (p.activeScenarioId = sid));
            setGrid(null);
          }}
        />
      );
    }
    if (workspace === "floorplans" || workspace === "overview") {
      return (
        <div className="space-y-4">
          <HierarchyPanel scenario={scn} activeFloorId={activeFloorId} actions={hierarchyActions} />
        </div>
      );
    }
    // Default: floor + visualization settings.
    return (
      <div className="space-y-4 text-sm">
        <div>
          <label className="label">Floor plan</label>
          {floor?.plan ? (
            <div className="text-xs text-base-muted">
              {floor.plan.fileName} · {(floor.plan.metersPerPixel ?? 0).toFixed(4)} m/px
            </div>
          ) : (
            <label className="btn btn-primary cursor-pointer text-xs">
              Upload PNG / JPEG / SVG
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </label>
          )}
        </div>
        <MaterialQuickPalette
          materials={project!.materials}
          activeId={activeMaterialId}
          onPick={(mid) => {
            setActiveMaterialId(mid);
            setToolId("wall");
          }}
        />
        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs">
            <span>Grid</span>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-xs">
            <span>AP labels</span>
            <input
              type="checkbox"
              checked={showApLabels}
              onChange={(e) => setShowApLabels(e.target.checked)}
            />
          </label>
        </div>
        <div className="rounded border border-yellow-600/40 bg-yellow-500/10 p-2 text-[11px] text-yellow-200">
          Predictive estimates only. Validate with an on-site survey and local regulations.
        </div>
      </div>
    );
  }

  function placeApFromCatalog(productId: string) {
    if (!floor) return;
    const { w, h } = floorExtentMeters();
    const ap = createAccessPoint(
      productId,
      { x: w / 2, y: h / 2 },
      `AP-${floor.accessPoints.length + 1}`,
    );
    update((p) => {
      const f = activeScenario(p).floors.find((x) => x.id === floor.id);
      f?.accessPoints.push(ap);
    });
    setSelection([ap.id]);
    setWorkspace("design");
    setGrid(null);
    push(`Added ${ap.name}`, "success");
  }

  const contextual =
    toolId === "wall" ? (
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: materialColor(activeMaterialId) }}
        />
        Drawing walls: click to add points, double-click or Enter to finish, Esc to cancel/exit.
        Material: <strong>{activeMaterialId}</strong>
      </span>
    ) : toolId === "scale" ? (
      <span>Scale: click two points on a known distance.</span>
    ) : toolId === "ap" ? (
      <span>
        Click on the plan to place an AP. Continuous placement is {pinContinuous ? "on" : "off"}.
      </span>
    ) : null;

  const invWarnings: { level: "warning" | "error"; message: string }[] = [];
  if (selectedAp) {
    const product = getProduct(selectedAp.productId);
    for (const r of selectedAp.radios) {
      const spec = product?.radios.find((x) => x.band === r.band);
      if (spec && r.txPowerDbm > spec.maxTxPowerDbm)
        invWarnings.push({
          level: "warning",
          message: `${r.band} GHz Tx power exceeds model max (${spec.maxTxPowerDbm} dBm).`,
        });
      if (spec === undefined && r.enabled)
        invWarnings.push({
          level: "error",
          message: `${r.band} GHz is not supported by ${product?.model}.`,
        });
    }
  }

  return (
    <div className="flex h-screen flex-col bg-base-bg">
      {dialog}
      {menu && (
        <ContextMenu
          items={menu.items}
          x={menu.x}
          y={menu.y}
          onAction={handleMenuAction}
          onClose={() => setMenu(null)}
        />
      )}
      {modelSelectorFor && (
        <ModelSelector
          currentProductId={floor?.accessPoints.find((a) => a.id === modelSelectorFor)?.productId}
          onChoose={(pid) => beginModelChange(modelSelectorFor, pid)}
          onCancel={() => setModelSelectorFor(null)}
        />
      )}
      {modelChange && (
        <ModelChangeSummary
          fromModel={modelChange.fromModel}
          toModel={modelChange.toModel}
          summary={modelChange.summary}
          onApply={confirmModelChange}
          onCancel={() => setModelChange(null)}
        />
      )}
      {/* A. Global header (compact) */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-base-border bg-base-panel px-3 text-sm">
        <Link href="/" className="text-base-muted hover:text-base-text" title="Back to projects">
          ‹ Projects
        </Link>
        <span className="font-semibold">Cisco Wi-Fi Planner</span>
        <span className="text-base-muted">/</span>
        <span className="truncate font-medium">{project.name}</span>
        <select
          className="input !w-auto !py-1"
          value={activeFloorId ?? ""}
          onChange={(e) => setActiveFloor(e.target.value)}
          aria-label="Floor"
        >
          {scn.floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          className="btn !py-1 !text-xs"
          onClick={() =>
            update((p) =>
              activeScenario(p).floors.push(createFloor(activeScenario(p).floors.length)),
            )
          }
        >
          + Floor
        </button>
        <div
          className="flex items-center gap-0.5 rounded-md border border-base-border p-0.5"
          role="group"
          aria-label="View mode"
        >
          {(["2d", "3d", "split"] as const).map((m) => (
            <button
              key={m}
              className={`rounded px-2 py-0.5 text-xs uppercase ${viewMode === m ? "bg-accent text-white" : "text-base-muted hover:text-base-text"}`}
              aria-pressed={viewMode === m}
              onClick={() => setViewMode(m)}
              data-testid={`view-${m}`}
            >
              {m}
            </button>
          ))}
        </div>
        <select
          className="input !w-auto !py-1"
          value={project.activeScenarioId}
          onChange={(e) => update((p) => (p.activeScenarioId = e.target.value))}
          aria-label="Scenario"
        >
          {project.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !py-1"
          value={project.regulatoryDomain}
          onChange={(e) => update((p) => (p.regulatoryDomain = e.target.value))}
          aria-label="Regulatory domain"
        >
          {["US", "EU", "TH"].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn !py-1 !text-xs" onClick={undo} title="Undo (Ctrl/Cmd+Z)">
            ↶
          </button>
          <button className="btn !py-1 !text-xs" onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z)">
            ↷
          </button>
          <ExportMenu project={project} scenarioId={scn.id} />
          <span
            className={`text-xs ${saveStatus === "error" ? "text-red-400" : "text-base-muted"}`}
            aria-live="polite"
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* B. Left nav rail */}
        <NavRail active={workspace} onChange={setWorkspace} />

        {/* C. Central canvas — 2D, 3D, or split. 3D is derived from the same data. */}
        {viewMode === "3d" ? (
          <section className="relative min-w-0 flex-1">
            <View3D
              scenario={scn}
              activeFloorId={activeFloorId}
              layerVisibility={layerVisibility}
              onSelectFloor={setActiveFloor}
            />
          </section>
        ) : viewMode === "split" ? (
          <section className="flex min-w-0 flex-1">
            <div className="relative min-w-0 flex-1 border-r border-base-border">
              {floor?.plan ? (
                <DesignCanvas
                  floor={floor}
                  materials={project.materials}
                  tool={toolId}
                  activeMaterialId={activeMaterialId}
                  pinContinuous={pinContinuous}
                  selectedIds={selectedIds}
                  grid={overlayOff || !showsAnalysis(layerVisibility, "WIFI") ? null : grid}
                  heatmapMode={heatmapMode}
                  heatmapOpacity={heatmapOpacity}
                  showGrid={showGrid}
                  showApLabels={showApLabels}
                  showApDevices={showsDevices(layerVisibility, "WIFI")}
                  onSelect={setSelection}
                  onPlaceAp={placeAp}
                  onCommitWall={commitWall}
                  onCalibrate={calibrate}
                  onMoveApTransient={moveApTransient}
                  onCursor={setCursor}
                  onViewport={(v) => (vpRef.current = v)}
                  onExitTool={() => setToolId("select")}
                  onMoveWallVertex={moveWallVertex}
                  onTranslateWall={translateWall}
                  onInsertWallVertex={insertWallVertex}
                  onRemoveWallVertex={removeWallVertex}
                  onAddOpening={addOpening}
                  onContextMenu={handleContextMenu}
                  onEditAp={(apId) => openApEditor(apId, "properties")}
                  floorPlanOpacity={floorPlanOpacity}
                  apIconSize={iconSize}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-base-muted">
                  Upload a floor plan to edit in 2D.
                </div>
              )}
            </div>
            <div className="relative min-w-0 flex-1">
              <View3D
                scenario={scn}
                activeFloorId={activeFloorId}
                layerVisibility={layerVisibility}
                onSelectFloor={setActiveFloor}
              />
            </div>
          </section>
        ) : (
          <section className="relative min-w-0 flex-1">
            {!floor?.plan ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-base-muted">
                <p>No floor plan for {floor?.name}.</p>
                <label className="btn btn-primary cursor-pointer">
                  Upload PNG / JPEG / SVG
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
                <p className="max-w-sm text-center text-xs">
                  PDF import requires rasterization (documented limitation — upload a PNG/JPEG of
                  the page).
                </p>
              </div>
            ) : (
              <DesignCanvas
                floor={floor}
                materials={project.materials}
                tool={toolId}
                activeMaterialId={activeMaterialId}
                pinContinuous={pinContinuous}
                selectedIds={selectedIds}
                grid={overlayOff || !showsAnalysis(layerVisibility, "WIFI") ? null : grid}
                heatmapMode={heatmapMode}
                heatmapOpacity={heatmapOpacity}
                showGrid={showGrid}
                showApLabels={showApLabels}
                showApDevices={showsDevices(layerVisibility, "WIFI")}
                onSelect={setSelection}
                onPlaceAp={placeAp}
                onCommitWall={commitWall}
                onCalibrate={calibrate}
                onMoveApTransient={moveApTransient}
                onCursor={setCursor}
                onViewport={(v) => (vpRef.current = v)}
                onExitTool={() => setToolId("select")}
                onMoveWallVertex={moveWallVertex}
                onTranslateWall={translateWall}
                onInsertWallVertex={insertWallVertex}
                onRemoveWallVertex={removeWallVertex}
                onAddOpening={addOpening}
                onContextMenu={handleContextMenu}
                onEditAp={(apId) => openApEditor(apId, "properties")}
                floorPlanOpacity={floorPlanOpacity}
                apIconSize={iconSize}
              />
            )}

            {/* Simulation controls (top-right float) */}
            <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border border-base-border bg-base-panel/90 px-2 py-1 text-xs">
              {(["2.4", "5", "6"] as Band[]).map((b) => (
                <button
                  key={b}
                  className={`rounded px-2 py-0.5 ${band === b ? "bg-accent text-white" : "text-base-muted hover:text-base-text"}`}
                  onClick={() => {
                    setBand(b);
                    setGrid(null);
                  }}
                >
                  {b}
                </button>
              ))}
              <select
                className="input !w-auto !py-0.5 !text-xs"
                value={resMode}
                onChange={(e) => setResMode(e.target.value as keyof typeof RES_MODES)}
              >
                <option value="draft">Draft</option>
                <option value="standard">Standard</option>
                <option value="high">High</option>
              </select>
              {simProgress === null ? (
                <button className="btn btn-primary !py-0.5 !text-xs" onClick={simulate}>
                  Simulate
                </button>
              ) : (
                <button className="btn !py-0.5 !text-xs" onClick={() => cancelRef.current()}>
                  Cancel {Math.round(simProgress * 100)}%
                </button>
              )}
            </div>

            {/* Floating analysis-mode tabs (top-center) */}
            {floor?.plan && (
              <ModeTabs
                active={overlayOff ? "off" : heatmapMode}
                onChange={(m) => {
                  if (m === "off") {
                    setOverlayOff(true);
                  } else {
                    setOverlayOff(false);
                    setHeatmapMode(m);
                  }
                }}
              />
            )}

            {/* Floating visualization panel (top-left) */}
            {floor?.plan && (
              <VisualizationPanel
                settings={{
                  coverageOpacity: heatmapOpacity,
                  wallOpacity,
                  floorPlanOpacity,
                  showApNames: showApLabels,
                  showChannels,
                  showGrid,
                  iconSize,
                  palette,
                }}
                onChange={(next: Partial<VizSettings>) => {
                  if (next.coverageOpacity !== undefined) setHeatmapOpacity(next.coverageOpacity);
                  if (next.wallOpacity !== undefined) setWallOpacity(next.wallOpacity);
                  if (next.floorPlanOpacity !== undefined)
                    setFloorPlanOpacity(next.floorPlanOpacity);
                  if (next.showApNames !== undefined) setShowApLabels(next.showApNames);
                  if (next.showChannels !== undefined) setShowChannels(next.showChannels);
                  if (next.showGrid !== undefined) setShowGrid(next.showGrid);
                  if (next.iconSize !== undefined) setIconSize(next.iconSize);
                  if (next.palette !== undefined) {
                    setPaletteState(next.palette);
                    setPalette(next.palette);
                  }
                }}
              />
            )}

            {/* Floating technology-layer visibility controls (top-right) */}
            {floor?.plan && (
              <LayerPanel visibility={layerVisibility} onChange={updateLayerVisibility} />
            )}

            {/* Bottom-right signal legend with band toggles */}
            {floor?.plan && !overlayOff && (
              <SignalLegend
                mode={heatmapMode}
                band={band}
                onBand={(b) => {
                  setBand(b);
                  setGrid(null);
                }}
              />
            )}

            {/* D. Floating bottom toolbar */}
            <BottomToolbar
              active={toolId}
              onSelect={setToolId}
              pinContinuous={pinContinuous}
              onTogglePin={() => setPinContinuous((v) => !v)}
              contextual={contextual}
            />

            {/* Bottom status bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 border-t border-base-border bg-base-panel px-3 py-1 text-[11px] text-base-muted">
              <span>
                Cursor: {cursor ? `${cursor.x.toFixed(2)}, ${cursor.y.toFixed(2)} m` : "—"}
              </span>
              <span>Zoom: {(vpRef.current.zoom * 100).toFixed(0)}%</span>
              <span>Band: {band} GHz</span>
              <span>Scale: {(floor?.plan?.metersPerPixel ?? 0).toFixed(4)} m/px</span>
              <span>
                {simProgress !== null
                  ? `Simulating ${Math.round(simProgress * 100)}%`
                  : grid
                    ? "Simulated"
                    : "Not simulated"}
              </span>
              {inspect && cursor && (
                <span className="ml-auto text-base-text">
                  RSSI {Number.isFinite(inspect.rssiDbm) ? inspect.rssiDbm : "—"} dBm · SNR{" "}
                  {Number.isFinite(inspect.snrDb) ? inspect.snrDb : "—"} dB · {inspect.mcsLabel} ·{" "}
                  {inspect.usableThroughputMbps} Mbps
                </span>
              )}
            </div>
          </section>
        )}

        {/* E. Floating dockable inspector */}
        <Inspector title={inspectorTitle()} warnings={invWarnings}>
          {inspectorBody()}
        </Inspector>
      </div>
    </div>
  );
}

/* ---------- Inspector sub-panels ---------- */

function MaterialQuickPalette({
  materials,
  activeId,
  onPick,
}: {
  materials: import("@/domain/model").WallMaterial[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <label className="label">Wall material (quick palette)</label>
      <div className="grid grid-cols-2 gap-1">
        {materials.map((m) => (
          <button
            key={m.id}
            className={`flex items-center gap-2 rounded border px-2 py-1 text-left text-xs ${
              activeId === m.id ? "border-accent" : "border-base-border hover:border-base-muted"
            }`}
            onClick={() => onPick(m.id)}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: materialColor(m.id) }}
            />
            {m.name}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-base-muted">
        Colors represent material type, not RF strength.
      </p>
    </div>
  );
}

function AnalysisPanel({
  legend,
  heatmapMode,
  setHeatmapMode,
  opacity,
  setOpacity,
}: {
  legend: { label: string; color: string }[];
  heatmapMode: HeatmapMode;
  setHeatmapMode: (m: HeatmapMode) => void;
  opacity: number;
  setOpacity: (o: number) => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="label">Heatmap metric</label>
        <select
          className="input"
          value={heatmapMode}
          onChange={(e) => setHeatmapMode(e.target.value as HeatmapMode)}
        >
          {HEATMAP_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Opacity</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="label">Legend</label>
        <div className="space-y-1 text-xs">
          {legend.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapacityPanel({
  servingApCount,
  onPlan,
  project,
}: {
  servingApCount: number;
  onPlan: () => void;
  project: import("@/domain/model").Project;
}) {
  const { update } = useEditor();
  const [users, setUsers] = useState(40);
  const [devices, setDevices] = useState(1.5);
  const [conc, setConc] = useState(80);
  const result = estimateZone(
    {
      name: "Zone",
      users,
      devicesPerUser: devices,
      concurrencyPct: conc,
      profile: "high-density-classroom",
      preferredBands: ["5"],
    },
    servingApCount,
  );
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={project.allowDfs}
          onChange={(e) => update((p) => (p.allowDfs = e.target.checked))}
        />
        Allow DFS channels (5 GHz)
      </label>
      <button className="btn btn-primary w-full" onClick={onPlan}>
        Auto-plan channels
      </button>
      <div className="border-t border-base-border pt-3">
        <label className="label">Users</label>
        <input
          type="number"
          className="input"
          value={users}
          onChange={(e) => setUsers(Number(e.target.value))}
        />
        <label className="label mt-2">Devices/user</label>
        <input
          type="number"
          step="0.1"
          className="input"
          value={devices}
          onChange={(e) => setDevices(Number(e.target.value))}
        />
        <label className="label mt-2">Concurrency %</label>
        <input
          type="number"
          className="input"
          value={conc}
          onChange={(e) => setConc(Number(e.target.value))}
        />
      </div>
      <div className="rounded border border-base-border p-2 text-xs">
        <div>Concurrent clients: {result.concurrentClients}</div>
        <div>Aggregate demand: {result.aggregateDemandMbps} Mbps</div>
        <div>
          Utilization:{" "}
          {Number.isFinite(result.apUtilization)
            ? `${Math.round(result.apUtilization * 100)}%`
            : "∞"}
        </div>
        {result.overloaded && (
          <div className="text-red-400">
            ⚠ Overloaded — add {result.suggestedAdditionalAps} AP(s)
          </div>
        )}
      </div>
      <p className="text-[10px] text-base-muted">
        Capacity is an estimate based on declared assumptions.
      </p>
    </div>
  );
}

function ScenarioInventoryPanel({
  project,
  onClone,
  onPromote,
  onSwitch,
}: {
  project: import("@/domain/model").Project;
  onClone: () => void;
  onPromote: (id: string) => void;
  onSwitch: (id: string) => void;
}) {
  const summaries = allScenarioSummaries(project);
  const active =
    project.scenarios.find((s) => s.id === project.activeScenarioId) ?? project.scenarios[0]!;
  const bom = scenarioBom(active);
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="label !mb-0">Scenario comparison</label>
          <button className="btn !py-0.5 !text-xs" onClick={onClone}>
            Clone
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-base-muted">
              <th className="text-left">Scenario</th>
              <th>APs</th>
              <th>Floors</th>
              <th>BOM</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.id} className={s.id === project.activeScenarioId ? "text-accent" : ""}>
                <td>
                  <button className="hover:underline" onClick={() => onSwitch(s.id)}>
                    {s.name} {s.isBaseline ? "★" : ""}
                  </button>
                </td>
                <td className="text-center">{s.apCount}</td>
                <td className="text-center">{s.floorCount}</td>
                <td className="text-center">{s.bomLines}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 space-y-1">
          {summaries.map((s) => (
            <button
              key={s.id}
              className="btn w-full !py-0.5 !text-xs"
              onClick={() => onPromote(s.id)}
            >
              Promote “{s.name}” to baseline
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Bill of materials — {active.name}</label>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-base-muted">
              <th className="text-left">Model</th>
              <th>Qty</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {bom.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-2 text-center text-base-muted">
                  No access points yet.
                </td>
              </tr>
            ) : (
              bom.map((l) => (
                <tr key={l.productId}>
                  <td>{l.model}</td>
                  <td className="text-center">{l.quantity}</td>
                  <td className="text-center">{l.verified ? "yes" : "sample"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExportMenu({
  project,
  scenarioId,
}: {
  project: import("@/domain/model").Project;
  scenarioId: string;
}) {
  const [open, setOpen] = useState(false);
  const scn = project.scenarios.find((s) => s.id === scenarioId) ?? project.scenarios[0]!;
  function exportPdf() {
    const html = reportHtml(project, scn);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    }
  }
  return (
    <div className="relative">
      <button className="btn !py-1 !text-xs" onClick={() => setOpen((o) => !o)}>
        Export ▾
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-1 w-52 panel p-1 text-xs"
          onMouseLeave={() => setOpen(false)}
        >
          <a
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-base-border"
            href={`/report/${project.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open shareable report
          </a>
          <button
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-base-border"
            onClick={exportPdf}
          >
            PDF design report (quick)
          </button>
          <button
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-base-border"
            onClick={() =>
              downloadText(`${project.name}-inventory.csv`, apInventoryCsv(scn), "text/csv")
            }
          >
            AP inventory (CSV)
          </button>
          <button
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-base-border"
            onClick={() => downloadText(`${project.name}-bom.csv`, bomCsv(scn), "text/csv")}
          >
            Bill of materials (CSV)
          </button>
          <button
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-base-border"
            onClick={() =>
              downloadText(`${project.name}.json`, projectJson(project), "application/json")
            }
          >
            Project (JSON)
          </button>
          <button
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-base-border"
            onClick={() =>
              downloadText(`${project.name}-placement.json`, placementJson(scn), "application/json")
            }
          >
            Placement (JSON)
          </button>
        </div>
      )}
    </div>
  );
}
