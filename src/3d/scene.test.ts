import { describe, it, expect } from "vitest";
import { buildScene3D, buildFloorSlab, scene3dFloorList } from "./scene";
import { createScenario, createFloor } from "@/domain/factory";
import type { Floor, Scenario } from "@/domain/model";

function floorWithWall(index: number, thickness: number, height: number): Floor {
  const f = createFloor(index, `Floor ${index + 1}`);
  f.baseElevationM = index * 3.5;
  f.plan = {
    id: `p${index}`,
    fileName: "f.png",
    imageSrc: "",
    widthPx: 1000,
    heightPx: 800,
    metersPerPixel: 0.05,
    locked: false,
    opacity: 1,
  };
  f.walls.push({
    id: `w${index}`,
    polyline: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    materialId: "concrete",
    thicknessM: thickness,
    heightM: height,
    bottomElevationM: 0,
    openings: [
      {
        id: "o",
        type: "door",
        segmentIndex: 0,
        t: 0.5,
        widthM: 1,
        heightM: 2.1,
        bottomElevationM: 0,
        open: false,
        attenuationDb: { "2.4": 2, "5": 3, "6": 3 },
      },
    ],
  });
  f.accessPoints.push({
    id: `ap${index}`,
    productId: "cat9166",
    productRevisionId: "sample-0.1.0",
    name: "AP",
    position: { x: 2, y: 2 },
    rotationDeg: 0,
    orientationAzimuthDegrees: 0,
    orientationDowntiltDegrees: 0,
    mountingType: "ceiling",
    mountingHeightM: 3,
    antennaAssignments: [],
    radios: [],
    modelOverrideWarnings: [],
    installStatus: "planned",
    locked: false,
  });
  return f;
}

function twoFloorScenario(): Scenario {
  return createScenario("S", [floorWithWall(0, 0.2, 2.7), floorWithWall(1, 0.15, 3.0)], true);
}

describe("3D scene derivation (mandatory §6)", () => {
  it("derives wall meshes from the 2D data with thickness + height (no separate model)", () => {
    const slab = buildFloorSlab(floorWithWall(0, 0.25, 2.8));
    expect(slab.walls).toHaveLength(1);
    expect(slab.walls[0]!.thicknessM).toBe(0.25);
    expect(slab.walls[0]!.heightM).toBe(2.8);
    // Wall base sits at the floor elevation + wall bottom elevation.
    expect(slab.walls[0]!.baseZ).toBe(0);
  });

  it("carries opening cutouts into wall meshes", () => {
    const slab = buildFloorSlab(floorWithWall(0, 0.2, 2.7));
    expect(slab.walls[0]!.openings).toHaveLength(1);
    expect(slab.walls[0]!.openings[0]!.widthM).toBeCloseTo(1, 6);
  });

  it("places devices at floor elevation + mounting height", () => {
    const slab = buildFloorSlab(floorWithWall(1, 0.2, 2.7)); // baseElevation 3.5
    expect(slab.devices).toHaveLength(1);
    expect(slab.devices[0]!.z).toBeCloseTo(3.5 + 3, 6);
  });

  it("stacks floors at their real elevations in building mode", () => {
    const scn = twoFloorScenario();
    const scene = buildScene3D(scn, { mode: "building" });
    expect(scene.floors).toHaveLength(2);
    expect(scene.floors[0]!.elevationZ).toBe(0);
    expect(scene.floors[1]!.elevationZ).toBe(3.5);
    expect(scene.totalHeightM).toBeCloseTo(3.5 + 3.0, 6);
  });

  it("floor mode returns only the requested floor", () => {
    const scn = twoFloorScenario();
    const second = scn.floors[1]!.id;
    const scene = buildScene3D(scn, { mode: "floor", floorId: second });
    expect(scene.floors).toHaveLength(1);
    expect(scene.floors[0]!.floorId).toBe(second);
  });

  it("excludes archived floors from the building scene", () => {
    const scn = twoFloorScenario();
    scn.floors[1]!.archived = true;
    const scene = buildScene3D(scn, { mode: "building" });
    expect(scene.floors).toHaveLength(1);
  });

  it("derives plan extents in meters from the floor plan + scale", () => {
    const slab = buildFloorSlab(floorWithWall(0, 0.2, 2.7)); // 1000x800 px @ 0.05 m/px
    expect(slab.widthM).toBeCloseTo(50, 6);
    expect(slab.depthM).toBeCloseTo(40, 6);
  });

  it("floor list is ordered and excludes archived", () => {
    const scn = twoFloorScenario();
    scn.floors[0]!.archived = true;
    const list = scene3dFloorList(scn);
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Floor 2");
  });
});
