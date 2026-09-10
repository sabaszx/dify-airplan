import { describe, it, expect } from "vitest";
import {
  orderedFloors,
  activeFloors,
  addFloor,
  archiveFloor,
  restoreFloor,
  deleteFloor,
  reorderFloors,
  moveFloorToBuilding,
  addBuilding,
  buildingsWithFloors,
  floorCounts,
} from "./hierarchy";
import { createScenario, createFloor } from "./factory";
import type { Scenario } from "./model";

function scenarioWithFloors(n: number): Scenario {
  const floors = Array.from({ length: n }, (_, i) => createFloor(i, `Floor ${i + 1}`));
  return createScenario("S", floors, true);
}

describe("floor hierarchy (mandatory §4)", () => {
  it("orders floors by explicit sortOrder/elevation, not string name", () => {
    const scn = scenarioWithFloors(3);
    // Give names that would sort wrong alphabetically vs their order.
    scn.floors[0]!.name = "Floor 10";
    scn.floors[1]!.name = "Floor 2";
    scn.floors[2]!.name = "Floor 1";
    scn.floors[0]!.sortOrder = 0;
    scn.floors[1]!.sortOrder = 1;
    scn.floors[2]!.sortOrder = 2;
    const ordered = orderedFloors(scn);
    expect(ordered.map((f) => f.sortOrder)).toEqual([0, 1, 2]);
    expect(ordered[0]!.name).toBe("Floor 10"); // order != string sort
  });

  it("adds a floor to a building", () => {
    let scn = scenarioWithFloors(1);
    scn = addFloor(scn, { name: "New" });
    expect(scn.floors).toHaveLength(2);
    expect(scn.buildings[0]!.floorIds.length).toBe(2);
  });

  it("adds a floor above/below a reference floor", () => {
    let scn = scenarioWithFloors(2);
    const bottom = orderedFloors(scn)[0]!;
    scn = addFloor(scn, { position: "below", relativeToFloorId: bottom.id, name: "Basement" });
    const ordered = orderedFloors(scn);
    expect(ordered[0]!.name).toBe("Basement");
  });

  it("duplicates a floor with fresh ids for its contents", () => {
    let scn = scenarioWithFloors(1);
    scn.floors[0]!.walls.push({
      id: "w1",
      polyline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      materialId: "concrete",
      thicknessM: 0.1,
      heightM: 2.7,
      bottomElevationM: 0,
      openings: [],
    });
    const srcId = scn.floors[0]!.id;
    scn = addFloor(scn, { duplicateFromFloorId: srcId });
    expect(scn.floors).toHaveLength(2);
    const copy = scn.floors[1]!;
    expect(copy.id).not.toBe(srcId);
    expect(copy.walls[0]!.id).not.toBe("w1"); // fresh wall id
    expect(copy.walls).toHaveLength(1);
  });

  it("archive excludes from active floors; restore brings it back", () => {
    let scn = scenarioWithFloors(2);
    const id = scn.floors[1]!.id;
    scn = archiveFloor(scn, id);
    expect(activeFloors(scn).some((f) => f.id === id)).toBe(false);
    scn = restoreFloor(scn, id);
    expect(activeFloors(scn).some((f) => f.id === id)).toBe(true);
  });

  it("delete removes a floor and its building reference", () => {
    let scn = scenarioWithFloors(2);
    const id = scn.floors[0]!.id;
    const res = deleteFloor(scn, id);
    expect(res.ok).toBe(true);
    if (res.ok) {
      scn = res.scenario;
      expect(scn.floors.some((f) => f.id === id)).toBe(false);
      expect(scn.buildings[0]!.floorIds).not.toContain(id);
    }
  });

  it("refuses to delete a floor referenced by a report snapshot", () => {
    const scn = scenarioWithFloors(2);
    const id = scn.floors[0]!.id;
    const res = deleteFloor(scn, id, [id]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("referenced");
  });

  it("refuses to delete the last remaining floor", () => {
    const scn = scenarioWithFloors(1);
    const res = deleteFloor(scn, scn.floors[0]!.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("last-floor");
  });

  it("reorders floors by explicit id list", () => {
    const scn = scenarioWithFloors(3);
    const ids = scn.floors.map((f) => f.id);
    const reversed = [...ids].reverse();
    const next = reorderFloors(scn, reversed);
    expect(orderedFloors(next).map((f) => f.id)).toEqual(reversed);
  });

  it("moves a floor to another building", () => {
    let scn = scenarioWithFloors(1);
    scn = addBuilding(scn, "Building 2");
    const floorId = scn.floors[0]!.id;
    const b2 = scn.buildings[1]!.id;
    scn = moveFloorToBuilding(scn, floorId, b2);
    expect(scn.buildings[0]!.floorIds).not.toContain(floorId);
    expect(scn.buildings[1]!.floorIds).toContain(floorId);
  });

  it("buildingsWithFloors resolves ordered floors per building", () => {
    const scn = scenarioWithFloors(2);
    const groups = buildingsWithFloors(scn);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.floors).toHaveLength(2);
  });

  it("reports structural floor counts", () => {
    const scn = scenarioWithFloors(1);
    const counts = floorCounts(scn.floors[0]!);
    expect(counts).toMatchObject({ walls: 0, accessPoints: 0, requirementZones: 0 });
  });
});
