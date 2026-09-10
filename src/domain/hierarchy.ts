/**
 * Floor-hierarchy operations (Area/Site/Building/Floor). Pure, framework-
 * independent helpers that transform a Scenario immutably. Ordering is explicit
 * (sortOrder / elevation), never string sorting. See override §4. Original code.
 */
import type { Scenario, Floor, Building } from "./model";
import { createFloor, createBuilding, uid } from "./factory";

export interface FloorCounts {
  walls: number;
  accessPoints: number;
  bleDevices: number;
  uwbDevices: number;
  requirementZones: number;
}

/** Floors ordered by explicit sortOrder, then base elevation, then floorNumber. */
export function orderedFloors(scenario: Scenario): Floor[] {
  return [...scenario.floors].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.baseElevationM - b.baseElevationM ||
      a.floorNumber - b.floorNumber,
  );
}

/** Active (non-archived) floors, ordered. */
export function activeFloors(scenario: Scenario): Floor[] {
  return orderedFloors(scenario).filter((f) => !f.archived);
}

export function floorCounts(floor: Floor): FloorCounts {
  // BLE/UWB device counts are derived elsewhere from catalog capability; here we
  // report Wi-Fi APs and structural counts. BLE/UWB remain 0 unless flagged.
  return {
    walls: floor.walls.length,
    accessPoints: floor.accessPoints.length,
    bleDevices: 0,
    uwbDevices: 0,
    requirementZones: floor.requirements.length,
  };
}

/** Ensure a scenario has at least one building; return the building id used. */
function ensureBuilding(scenario: Scenario): { scenario: Scenario; buildingId: string } {
  if (scenario.buildings.length > 0) {
    return { scenario, buildingId: scenario.buildings[0]!.id };
  }
  const building = createBuilding(
    "Building 1",
    scenario.floors.map((f) => f.id),
  );
  return {
    scenario: { ...scenario, buildings: [building] },
    buildingId: building.id,
  };
}

/** Add a floor to a building. Position "above"/"below" uses relative sortOrder. */
export function addFloor(
  scenario: Scenario,
  opts: {
    buildingId?: string;
    name?: string;
    position?: "above" | "below" | "top" | "bottom";
    relativeToFloorId?: string;
    duplicateFromFloorId?: string;
  } = {},
): Scenario {
  const withBuilding = ensureBuilding(scenario);
  let scn = withBuilding.scenario;
  const buildingId = opts.buildingId ?? withBuilding.buildingId;

  let floor: Floor;
  if (opts.duplicateFromFloorId) {
    const src = scn.floors.find((f) => f.id === opts.duplicateFromFloorId);
    if (!src) throw new Error("Source floor not found for duplication.");
    floor = duplicateFloorData(src);
  } else {
    floor = createFloor(scn.floors.length, opts.name);
  }

  // Compute the new sortOrder / elevation.
  const ordered = orderedFloors(scn);
  let newOrder: number;
  if (opts.relativeToFloorId) {
    const ref = scn.floors.find((f) => f.id === opts.relativeToFloorId);
    const refOrder = ref?.sortOrder ?? ordered.length;
    newOrder = opts.position === "below" ? refOrder - 0.5 : refOrder + 0.5;
  } else if (opts.position === "bottom") {
    newOrder = (ordered[0]?.sortOrder ?? 0) - 1;
  } else {
    newOrder = (ordered[ordered.length - 1]?.sortOrder ?? -1) + 1;
  }
  floor = { ...floor, sortOrder: newOrder };

  scn = {
    ...scn,
    floors: normalizeOrder([...scn.floors, floor]),
    buildings: scn.buildings.map((b) =>
      b.id === buildingId ? { ...b, floorIds: [...b.floorIds, floor.id] } : b,
    ),
  };
  return scn;
}

/** Duplicate a floor's contents into a new floor with fresh ids. */
export function duplicateFloorData(src: Floor): Floor {
  const clone: Floor = JSON.parse(JSON.stringify(src));
  return {
    ...clone,
    id: uid("floor"),
    name: `${src.name} (copy)`,
    walls: clone.walls.map((w) => ({ ...w, id: uid("wall") })),
    accessPoints: clone.accessPoints.map((ap) => ({ ...ap, id: uid("ap") })),
    requirements: clone.requirements.map((r) => ({ ...r, id: uid("zone") })),
  };
}

/** Archive a floor (recoverable, excluded from active design). */
export function archiveFloor(scenario: Scenario, floorId: string): Scenario {
  return {
    ...scenario,
    floors: scenario.floors.map((f) => (f.id === floorId ? { ...f, archived: true } : f)),
  };
}

export function restoreFloor(scenario: Scenario, floorId: string): Scenario {
  return {
    ...scenario,
    floors: scenario.floors.map((f) => (f.id === floorId ? { ...f, archived: false } : f)),
  };
}

/**
 * Permanently delete a floor. Refuses when the floor is referenced by an
 * immutable report snapshot (caller supplies referenced floor ids). Returns a
 * result so the UI can offer "archive instead". See override §4.2.
 */
export function deleteFloor(
  scenario: Scenario,
  floorId: string,
  referencedByReportFloorIds: string[] = [],
): { ok: true; scenario: Scenario } | { ok: false; reason: "referenced" | "last-floor" } {
  if (referencedByReportFloorIds.includes(floorId)) return { ok: false, reason: "referenced" };
  const remaining = scenario.floors.filter((f) => f.id !== floorId);
  if (remaining.length === 0) return { ok: false, reason: "last-floor" };
  return {
    ok: true,
    scenario: {
      ...scenario,
      floors: remaining,
      buildings: scenario.buildings.map((b) => ({
        ...b,
        floorIds: b.floorIds.filter((id) => id !== floorId),
      })),
    },
  };
}

/** Reorder floors by an explicit ordered list of ids (drag/numeric reorder). */
export function reorderFloors(scenario: Scenario, orderedIds: string[]): Scenario {
  const byId = new Map(scenario.floors.map((f) => [f.id, f] as const));
  const reordered = orderedIds
    .map((id, i) => {
      const f = byId.get(id);
      return f ? { ...f, sortOrder: i } : null;
    })
    .filter((f): f is Floor => f !== null);
  // Keep any floors not present in orderedIds at the end.
  const missing = scenario.floors.filter((f) => !orderedIds.includes(f.id));
  return { ...scenario, floors: [...reordered, ...missing] };
}

/** Move a floor to another building. */
export function moveFloorToBuilding(
  scenario: Scenario,
  floorId: string,
  buildingId: string,
): Scenario {
  return {
    ...scenario,
    buildings: scenario.buildings.map((b) => ({
      ...b,
      floorIds:
        b.id === buildingId
          ? Array.from(new Set([...b.floorIds, floorId]))
          : b.floorIds.filter((id) => id !== floorId),
    })),
  };
}

export function addBuilding(scenario: Scenario, name: string): Scenario {
  return { ...scenario, buildings: [...scenario.buildings, createBuilding(name)] };
}

/** Reassign contiguous sortOrder values (0..n-1) preserving current order. */
function normalizeOrder(floors: Floor[]): Floor[] {
  const ordered = [...floors].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.baseElevationM - b.baseElevationM,
  );
  return ordered.map((f, i) => ({ ...f, sortOrder: i }));
}

/** Buildings not archived, with resolved (ordered) floors. */
export function buildingsWithFloors(scenario: Scenario): { building: Building; floors: Floor[] }[] {
  const byId = new Map(scenario.floors.map((f) => [f.id, f] as const));
  return scenario.buildings.map((building) => ({
    building,
    floors: orderedFloors({
      ...scenario,
      floors: building.floorIds.map((id) => byId.get(id)).filter((f): f is Floor => !!f),
    }),
  }));
}
