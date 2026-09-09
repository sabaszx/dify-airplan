/**
 * Editor store (Zustand). Holds the active project, provides autosave with a
 * visible save status, and an undo/redo command history over project snapshots.
 * See requirements.md §1, §12 and design.md §1.
 */
"use client";

import { create } from "zustand";
import type { Project, Scenario, Floor, AccessPoint, Wall } from "@/domain/model";
import { ProjectSchema } from "@/domain/model";
import { localProjectStore } from "@/lib/storage";
import { nowIso } from "@/domain/factory";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type Tool = "select" | "pan" | "scale" | "wall" | "area" | "ap" | "measure" | "annotate";

interface EditorState {
  project: Project | null;
  saveStatus: SaveStatus;
  activeTool: Tool;
  activeFloorId: string | null;
  selectedIds: string[];
  // undo/redo stacks of serialized project snapshots
  past: string[];
  future: string[];
  saveTimer: ReturnType<typeof setTimeout> | null;

  loadProject: (p: Project) => void;
  setTool: (t: Tool) => void;
  setActiveFloor: (id: string) => void;
  setSelection: (ids: string[]) => void;

  /** Apply a mutation, push undo state, and schedule autosave. */
  update: (mutator: (p: Project) => void, opts?: { transient?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  scheduleSave: () => void;
}

function clone(p: Project): Project {
  return JSON.parse(JSON.stringify(p));
}

export function activeScenario(p: Project): Scenario {
  return p.scenarios.find((s) => s.id === p.activeScenarioId) ?? p.scenarios[0]!;
}

export function activeFloor(p: Project, floorId: string | null): Floor | null {
  const scn = activeScenario(p);
  if (!floorId) return scn.floors[0] ?? null;
  return scn.floors.find((f) => f.id === floorId) ?? scn.floors[0] ?? null;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  saveStatus: "idle",
  activeTool: "select",
  activeFloorId: null,
  selectedIds: [],
  past: [],
  future: [],
  saveTimer: null,

  loadProject(p) {
    const scn = p.scenarios.find((s) => s.id === p.activeScenarioId) ?? p.scenarios[0]!;
    set({
      project: p,
      activeFloorId: scn.floors[0]?.id ?? null,
      past: [],
      future: [],
      selectedIds: [],
      saveStatus: "saved",
    });
  },

  setTool(t) {
    set({ activeTool: t });
  },
  setActiveFloor(id) {
    set({ activeFloorId: id, selectedIds: [] });
  },
  setSelection(ids) {
    set({ selectedIds: ids });
  },

  update(mutator, opts) {
    const cur = get().project;
    if (!cur) return;
    const snapshot = JSON.stringify(cur);
    const next = clone(cur);
    mutator(next);
    next.updatedAt = nowIso();
    if (opts?.transient) {
      // Transient changes (e.g., live drag) do not push a history entry.
      set({ project: next });
      return;
    }
    set((s) => ({
      project: next,
      past: [...s.past, snapshot].slice(-100),
      future: [],
    }));
    get().scheduleSave();
  },

  undo() {
    const { past, project } = get();
    if (past.length === 0 || !project) return;
    const prev = past[past.length - 1]!;
    set((s) => ({
      project: ProjectSchema.parse(JSON.parse(prev)),
      past: s.past.slice(0, -1),
      future: [JSON.stringify(project), ...s.future].slice(0, 100),
    }));
    get().scheduleSave();
  },

  redo() {
    const { future, project } = get();
    if (future.length === 0 || !project) return;
    const nextSnap = future[0]!;
    set((s) => ({
      project: ProjectSchema.parse(JSON.parse(nextSnap)),
      future: s.future.slice(1),
      past: [...s.past, JSON.stringify(project)].slice(-100),
    }));
    get().scheduleSave();
  },

  scheduleSave() {
    const existing = get().saveTimer;
    if (existing) clearTimeout(existing);
    set({ saveStatus: "saving" });
    const timer = setTimeout(async () => {
      const p = get().project;
      if (!p) return;
      try {
        await localProjectStore.save(p);
        set({ saveStatus: "saved" });
      } catch {
        set({ saveStatus: "error" });
      }
    }, 600);
    set({ saveTimer: timer });
  },
}));

// Convenience mutators used by UI components.
export function addAccessPoint(ap: AccessPoint, floorId: string) {
  useEditor.getState().update((p) => {
    const scn = activeScenario(p);
    const floor = scn.floors.find((f) => f.id === floorId);
    if (floor) floor.accessPoints.push(ap);
  });
}

export function addWall(wall: Wall, floorId: string) {
  useEditor.getState().update((p) => {
    const scn = activeScenario(p);
    const floor = scn.floors.find((f) => f.id === floorId);
    if (floor) floor.walls.push(wall);
  });
}
