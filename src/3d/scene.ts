/**
 * Derive 3D scene geometry from the SAME 2D project data — there is no separate,
 * manually edited 3D model. Pure and framework/GPU-independent so it is testable
 * without a browser. The Three.js view (dynamically imported) consumes this.
 * See override §6. Original code. Units: meters.
 */
import type { Scenario, Floor } from "@/domain/model";
import { orderedFloors, activeFloors } from "@/domain/hierarchy";
import type { Vec2 } from "@/geometry";

export interface WallMesh {
  id: string;
  /** Centerline segment endpoints (meters). */
  a: Vec2;
  b: Vec2;
  thicknessM: number;
  heightM: number;
  /** Bottom of the wall in world Z (floor elevation + wall base elevation). */
  baseZ: number;
  materialId: string;
  /** Openings along this wall (as fractional spans) for cutouts. */
  openings: { t: number; widthM: number; heightM: number; bottomElevationM: number }[];
}

export interface DeviceMarker {
  id: string;
  kind: "ap";
  position: Vec2;
  /** World Z of the device (floor elevation + mounting height). */
  z: number;
  rotationDeg: number;
  directional: boolean;
  beamwidthDeg?: number;
}

export interface FloorSlab {
  floorId: string;
  name: string;
  /** World Z of the floor surface. */
  elevationZ: number;
  ceilingHeightM: number;
  /** Plan bounds in meters (from the floor plan image + scale). */
  widthM: number;
  depthM: number;
  walls: WallMesh[];
  devices: DeviceMarker[];
}

export interface Scene3D {
  floors: FloorSlab[];
  /** Total building height (meters) for camera framing. */
  totalHeightM: number;
}

function floorExtent(floor: Floor): { widthM: number; depthM: number } {
  const mpp = floor.plan?.metersPerPixel ?? 0.02;
  return {
    widthM: (floor.plan?.widthPx ?? 1200) * mpp,
    depthM: (floor.plan?.heightPx ?? 800) * mpp,
  };
}

function segmentLength(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Build a floor slab (walls + devices) at a given base elevation. */
export function buildFloorSlab(floor: Floor): FloorSlab {
  const { widthM, depthM } = floorExtent(floor);
  const elevationZ = floor.baseElevationM;

  const walls: WallMesh[] = [];
  for (const w of floor.walls) {
    for (let i = 0; i < w.polyline.length - 1; i++) {
      const a = w.polyline[i]!;
      const b = w.polyline[i + 1]!;
      const segLen = segmentLength(a, b);
      const openings = w.openings
        .filter((o) => o.segmentIndex === i)
        .map((o) => ({
          t: o.t,
          widthM: segLen > 0 ? Math.min(o.widthM, segLen) : o.widthM,
          heightM: o.heightM,
          bottomElevationM: o.bottomElevationM,
        }));
      walls.push({
        id: `${w.id}:${i}`,
        a,
        b,
        thicknessM: w.thicknessM,
        heightM: w.heightM,
        baseZ: elevationZ + w.bottomElevationM,
        materialId: w.materialId,
        openings,
      });
    }
  }

  const devices: DeviceMarker[] = floor.accessPoints.map((ap) => ({
    id: ap.id,
    kind: "ap",
    position: ap.position,
    z: elevationZ + ap.mountingHeightM,
    rotationDeg: ap.rotationDeg,
    directional: ap.antennaOverride ? !ap.antennaOverride.omnidirectional : false,
    beamwidthDeg: ap.antennaOverride?.beamwidthDeg,
  }));

  return {
    floorId: floor.id,
    name: floor.name,
    elevationZ,
    ceilingHeightM: floor.ceilingHeightM,
    widthM,
    depthM,
    walls,
    devices,
  };
}

/**
 * Build the whole 3D scene. `mode` selects a single floor (3D Floor) or all
 * active floors stacked at their real elevations (3D Building). Archived floors
 * are excluded.
 */
export function buildScene3D(
  scenario: Scenario,
  opts: { mode: "floor" | "building"; floorId?: string } = { mode: "building" },
): Scene3D {
  let floors: Floor[];
  if (opts.mode === "floor") {
    const target = scenario.floors.find((f) => f.id === opts.floorId) ?? activeFloors(scenario)[0];
    floors = target ? [target] : [];
  } else {
    floors = activeFloors(scenario);
  }

  const slabs = floors.map(buildFloorSlab);
  const totalHeightM = slabs.reduce((max, s) => Math.max(max, s.elevationZ + s.ceilingHeightM), 0);
  return { floors: slabs, totalHeightM };
}

/** Convenience: ordered floor list for a floor picker in the 3D UI. */
export function scene3dFloorList(
  scenario: Scenario,
): { id: string; name: string; elevationZ: number }[] {
  return orderedFloors(scenario)
    .filter((f) => !f.archived)
    .map((f) => ({ id: f.id, name: f.name, elevationZ: f.baseElevationM }));
}
