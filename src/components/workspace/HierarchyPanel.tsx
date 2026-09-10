"use client";

import { useState } from "react";
import type { Scenario, Floor } from "@/domain/model";
import { buildingsWithFloors, floorCounts, activeFloors } from "@/domain/hierarchy";

/**
 * Floor-hierarchy panel: Area/Site/Building/Floor tree with expand/collapse,
 * counts, selected highlight, and per-node actions. Ordering is explicit
 * (sortOrder/elevation), never string sort. Keyboard accessible. Original UI.
 * See override §4.1.
 */
export interface HierarchyActions {
  onOpenFloor: (floorId: string) => void;
  onAddFloor: (buildingId: string, position: "top" | "bottom") => void;
  onAddFloorRelative: (floorId: string, position: "above" | "below") => void;
  onDuplicateFloor: (floorId: string) => void;
  onRenameFloor: (floorId: string, name: string) => void;
  onArchiveFloor: (floorId: string) => void;
  onRestoreFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
  onReorderFloor: (floorId: string, direction: "up" | "down") => void;
  onAddBuilding: () => void;
}

export function HierarchyPanel({
  scenario,
  activeFloorId,
  actions,
}: {
  scenario: Scenario;
  activeFloorId: string | null;
  actions: HierarchyActions;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const groups = buildingsWithFloors(scenario);
  const activeCount = activeFloors(scenario).length;

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2 text-sm" data-testid="hierarchy-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs text-base-muted">Global · {activeCount} active floors</span>
        <button className="btn !px-2 !py-0.5 !text-xs" onClick={actions.onAddBuilding}>
          + Building
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-base-muted">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>

      <ul role="tree" aria-label="Network hierarchy" className="space-y-1">
        {groups.map(({ building, floors }) => {
          const isOpen = !expanded.has(building.id) ? true : false; // default expanded
          const open = !expanded.has(`c-${building.id}`);
          const visibleFloors = floors.filter((f) => showArchived || !f.archived);
          return (
            <li key={building.id} role="treeitem" aria-expanded={open} aria-selected={false}>
              <div className="flex items-center gap-1 rounded px-1 py-1 hover:bg-base-border/40">
                <button
                  className="w-4 text-base-muted"
                  aria-label={open ? "Collapse building" : "Expand building"}
                  onClick={() => toggle(`c-${building.id}`)}
                >
                  {open ? "▾" : "▸"}
                </button>
                <span aria-hidden>🏢</span>
                <span className="flex-1 font-medium">{building.name}</span>
                <span className="text-[10px] text-base-muted">{visibleFloors.length}</span>
                <button
                  className="rounded px-1 text-base-muted hover:text-base-text"
                  title="Add floor to top"
                  onClick={() => actions.onAddFloor(building.id, "top")}
                >
                  +
                </button>
                {void isOpen}
              </div>

              {open && (
                <ul role="group" className="ml-4 space-y-0.5">
                  {visibleFloors.length === 0 && (
                    <li className="px-2 py-1 text-[11px] text-base-muted">No floors.</li>
                  )}
                  {visibleFloors.map((f, idx) => (
                    <FloorRow
                      key={f.id}
                      floor={f}
                      isActive={f.id === activeFloorId}
                      isFirst={idx === 0}
                      isLast={idx === visibleFloors.length - 1}
                      menuOpen={menuFor === f.id}
                      onToggleMenu={() => setMenuFor((m) => (m === f.id ? null : f.id))}
                      actions={actions}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FloorRow({
  floor,
  isActive,
  isFirst,
  isLast,
  menuOpen,
  onToggleMenu,
  actions,
}: {
  floor: Floor;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  actions: HierarchyActions;
}) {
  const counts = floorCounts(floor);
  return (
    <li role="treeitem" aria-selected={isActive} className="relative">
      <div
        className={`flex items-center gap-1 rounded px-1 py-1 ${
          isActive ? "bg-accent/20 text-accent" : "hover:bg-base-border/40"
        } ${floor.archived ? "opacity-50" : ""}`}
      >
        <span aria-hidden className="w-4 text-center">
          ▤
        </span>
        <button
          className="flex-1 text-left"
          onClick={() => actions.onOpenFloor(floor.id)}
          title="Open floor"
        >
          {floor.name}
          {floor.archived && <span className="ml-1 text-[9px]">(archived)</span>}
        </button>
        <span className="text-[10px] text-base-muted" title="APs / walls / zones">
          {counts.accessPoints}/{counts.walls}/{counts.requirementZones}
        </span>
        <button
          className="rounded px-1 text-base-muted hover:text-base-text"
          aria-label="Floor actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-0.5 w-44 rounded-md border border-base-border bg-base-panel py-1 text-xs shadow-lg"
        >
          <MenuItem label="Open floor" onClick={() => actions.onOpenFloor(floor.id)} />
          <MenuItem
            label="Add floor above"
            onClick={() => actions.onAddFloorRelative(floor.id, "above")}
          />
          <MenuItem
            label="Add floor below"
            onClick={() => actions.onAddFloorRelative(floor.id, "below")}
          />
          <MenuItem label="Duplicate floor" onClick={() => actions.onDuplicateFloor(floor.id)} />
          <MenuItem
            label="Rename"
            onClick={() => {
              const name = window.prompt("Floor name:", floor.name);
              if (name) actions.onRenameFloor(floor.id, name);
            }}
          />
          {!isFirst && (
            <MenuItem label="Move up" onClick={() => actions.onReorderFloor(floor.id, "up")} />
          )}
          {!isLast && (
            <MenuItem label="Move down" onClick={() => actions.onReorderFloor(floor.id, "down")} />
          )}
          {floor.archived ? (
            <MenuItem label="Restore" onClick={() => actions.onRestoreFloor(floor.id)} />
          ) : (
            <MenuItem label="Archive" onClick={() => actions.onArchiveFloor(floor.id)} />
          )}
          <div className="my-1 h-px bg-base-border" />
          <MenuItem label="Delete" destructive onClick={() => actions.onDeleteFloor(floor.id)} />
        </div>
      )}
    </li>
  );
}

function MenuItem({
  label,
  onClick,
  destructive,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      role="menuitem"
      className={`block w-full px-3 py-1.5 text-left hover:bg-base-border ${destructive ? "text-red-300" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
