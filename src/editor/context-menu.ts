/**
 * Object-aware context-menu definitions and viewport clamping. The menu items
 * per object type are pure data so they can be unit-tested; the React component
 * renders them. See override §9. `actionId`s are consumed by the workspace to
 * update the shared selection/inspector state.
 */
import type { HitKind } from "./hit-test";

export interface MenuItem {
  actionId: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  /** Visual separator BEFORE this item. */
  separatorBefore?: boolean;
  submenu?: MenuItem[];
}

/** Build the menu for a given object kind. `overlap` adds a "Select" submenu. */
export function menuForKind(
  kind: HitKind,
  opts: { locked?: boolean; overlap?: { actionId: string; label: string }[] } = {},
): MenuItem[] {
  let items: MenuItem[];
  switch (kind) {
    case "access-point":
      items = [
        { actionId: "ap.edit", label: "Edit Access Point" },
        { actionId: "ap.changeModel", label: "Change Model" },
        { actionId: "ap.configureRadios", label: "Configure Radios" },
        { actionId: "ap.changeAntenna", label: "Change Antenna" },
        { actionId: "ap.viewPattern", label: "View Antenna Pattern" },
        { actionId: "ap.rotate", label: "Rotate", separatorBefore: true },
        { actionId: "ap.setHeight", label: "Set Mounting Height" },
        { actionId: "ap.duplicate", label: "Duplicate", separatorBefore: true },
        { actionId: "ap.copy", label: "Copy" },
        { actionId: "ap.moveFloor", label: "Move to Another Floor" },
        { actionId: "ap.addToSelection", label: "Add to Selection" },
        { actionId: "ap.lock", label: opts.locked ? "Unlock" : "Lock" },
        { actionId: "ap.toggleCoverage", label: "Hide/Show Coverage" },
        { actionId: "ap.inspectCoverage", label: "Inspect Coverage" },
        { actionId: "ap.viewDatasheet", label: "View Product Datasheet" },
        { actionId: "ap.delete", label: "Delete", destructive: true, separatorBefore: true },
      ];
      break;
    case "wall":
      items = [
        { actionId: "wall.edit", label: "Edit Wall" },
        { actionId: "wall.changeMaterial", label: "Change Material" },
        { actionId: "wall.insertVertex", label: "Insert Vertex Here" },
        { actionId: "wall.split", label: "Split Wall Here" },
        { actionId: "wall.extend", label: "Extend" },
        { actionId: "wall.trim", label: "Trim" },
        { actionId: "wall.addDoor", label: "Add Door", separatorBefore: true },
        { actionId: "wall.addWindow", label: "Add Window" },
        { actionId: "wall.duplicate", label: "Duplicate", separatorBefore: true },
        { actionId: "wall.copy", label: "Copy" },
        { actionId: "wall.lock", label: opts.locked ? "Unlock" : "Lock" },
        { actionId: "wall.hide", label: "Hide/Show" },
        { actionId: "wall.delete", label: "Delete", destructive: true, separatorBefore: true },
      ];
      break;
    case "wall-vertex":
      items = [
        { actionId: "vertex.move", label: "Move Vertex" },
        { actionId: "vertex.remove", label: "Remove Vertex", destructive: true },
        { actionId: "vertex.disconnect", label: "Disconnect" },
        { actionId: "vertex.shared", label: "Convert to Shared Vertex" },
        { actionId: "vertex.inspect", label: "Inspect Coordinates", separatorBefore: true },
      ];
      break;
    case "opening":
      items = [
        { actionId: "opening.edit", label: "Edit Opening" },
        { actionId: "opening.changeType", label: "Change Type" },
        { actionId: "opening.toggleOpen", label: "Set Open/Closed" },
        { actionId: "opening.move", label: "Move Along Wall" },
        { actionId: "opening.duplicate", label: "Duplicate", separatorBefore: true },
        { actionId: "opening.delete", label: "Delete", destructive: true },
      ];
      break;
    case "requirement-zone":
      items = [
        { actionId: "zone.edit", label: "Edit Requirements" },
        { actionId: "zone.changeType", label: "Change Zone Type" },
        { actionId: "zone.clientProfile", label: "Set Client Profile" },
        { actionId: "zone.compliance", label: "View Coverage Compliance" },
        { actionId: "zone.duplicate", label: "Duplicate", separatorBefore: true },
        { actionId: "zone.copy", label: "Copy" },
        { actionId: "zone.lock", label: opts.locked ? "Unlock" : "Lock" },
        { actionId: "zone.delete", label: "Delete", destructive: true, separatorBefore: true },
      ];
      break;
    case "background":
      items = [
        { actionId: "bg.calibrate", label: "Calibrate Scale" },
        { actionId: "bg.change", label: "Change Floor Plan" },
        { actionId: "bg.opacity", label: "Adjust Opacity" },
        { actionId: "bg.contrast", label: "Adjust Contrast" },
        { actionId: "bg.lock", label: opts.locked ? "Unlock" : "Lock" },
        { actionId: "bg.fit", label: "Fit to View", separatorBefore: true },
        { actionId: "bg.reset", label: "Reset Transform" },
      ];
      break;
    case "empty":
    default:
      items = [
        { actionId: "canvas.paste", label: "Paste" },
        { actionId: "canvas.addAp", label: "Add Access Point Here", separatorBefore: true },
        { actionId: "canvas.startWall", label: "Start Wall Here" },
        { actionId: "canvas.addZone", label: "Add Requirement Zone" },
        { actionId: "canvas.addAnnotation", label: "Add Annotation" },
        { actionId: "canvas.measure", label: "Measure From Here" },
        { actionId: "canvas.fit", label: "Fit to View", separatorBefore: true },
        { actionId: "canvas.simSettings", label: "Simulation Settings" },
      ];
      break;
  }

  if (opts.overlap && opts.overlap.length > 1) {
    items = [
      {
        actionId: "select.behind",
        label: "Select Behind",
      },
      {
        actionId: "select.fromList",
        label: "Select From List",
        submenu: opts.overlap.map((o) => ({ actionId: o.actionId, label: o.label })),
      },
      { actionId: "__sep", label: "", separatorBefore: true, disabled: true },
      ...items,
    ];
  }

  return items;
}

/**
 * Clamp a desired menu position so the menu stays within the viewport.
 * See override §8 ("remain inside the visible viewport").
 */
export function clampMenuPosition(
  desired: { x: number; y: number },
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { x: number; y: number } {
  const x = Math.min(
    Math.max(margin, desired.x),
    Math.max(margin, viewport.width - menu.width - margin),
  );
  const y = Math.min(
    Math.max(margin, desired.y),
    Math.max(margin, viewport.height - menu.height - margin),
  );
  return { x, y };
}
