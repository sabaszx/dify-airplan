/**
 * Backward-compatible project migrations. Applies documented defaults to records
 * saved by earlier versions so existing projects keep opening after schema
 * additions (wall thickness/height/openings, floor hierarchy, material versions,
 * technology visibility). Pure and idempotent. See override §8. Original code.
 *
 * Rollback/recovery: migrations are additive and non-destructive — they only
 * fill in missing fields with defaults and never drop existing data. To recover
 * a pre-migration copy, restore from the user's JSON export (dashboard Export).
 */

/** Documented default physical wall thickness for legacy walls (meters). */
export const DEFAULT_WALL_THICKNESS_M = 0.1;
export const DEFAULT_WALL_HEIGHT_M = 2.7;

type AnyRecord = Record<string, unknown>;

function isObj(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Migrate a raw persisted project to the current shape. Returns a new object;
 * does not mutate the input.
 */
export function migrateProject(input: unknown): unknown {
  if (!isObj(input)) return input;
  const p: AnyRecord = { ...input };

  // Materials: ensure a version/audit stamp exists (additive).
  if (Array.isArray(p.materials)) {
    p.materials = p.materials.map((m) => (isObj(m) ? migrateMaterial(m) : m));
  }

  // Scenarios -> floors -> walls / floor hierarchy.
  if (Array.isArray(p.scenarios)) {
    p.scenarios = p.scenarios.map((s) => (isObj(s) ? migrateScenario(s) : s));
  }

  return p;
}

function migrateMaterial(m: AnyRecord): AnyRecord {
  const out: AnyRecord = { ...m };
  if (out.version === undefined) out.version = 1;
  if (out.archived === undefined) out.archived = false;
  return out;
}

function migrateScenario(s: AnyRecord): AnyRecord {
  const out: AnyRecord = { ...s };
  if (Array.isArray(out.floors)) {
    const floors = out.floors.map((f, i) => (isObj(f) ? migrateFloor(f, i) : f));
    // Floor hierarchy: place legacy floors under a default building when none exists.
    if (out.buildings === undefined) {
      out.buildings = [
        {
          id: `building_${String(s.id ?? "default")}`,
          name: "Building 1",
          floorIds: floors.map((f) => (isObj(f) ? (f.id as string) : "")).filter(Boolean),
        },
      ];
    }
    out.floors = floors;
  }
  return out;
}

function migrateFloor(f: AnyRecord, index: number): AnyRecord {
  const out: AnyRecord = { ...f };

  // Explicit ordering + elevation (do not rely on string sorting).
  if (out.sortOrder === undefined)
    out.sortOrder = typeof out.index === "number" ? out.index : index;
  if (out.floorNumber === undefined) out.floorNumber = index + 1;
  if (out.baseElevationM === undefined) out.baseElevationM = index * 3.5;
  if (out.floorToFloorM === undefined) out.floorToFloorM = 3.5;
  if (out.archived === undefined) out.archived = false;

  // Walls: physical thickness/height/openings defaults for legacy walls.
  if (Array.isArray(out.walls)) {
    out.walls = out.walls.map((w) => (isObj(w) ? migrateWall(w) : w));
  }

  // Access points: ensure arrays that later code assumes exist.
  if (Array.isArray(out.accessPoints)) {
    out.accessPoints = out.accessPoints.map((ap) =>
      isObj(ap) ? { antennaAssignments: [], modelOverrideWarnings: [], ...ap } : ap,
    );
  }
  return out;
}

function migrateWall(w: AnyRecord): AnyRecord {
  const out: AnyRecord = { ...w };
  if (typeof out.thicknessM !== "number") out.thicknessM = DEFAULT_WALL_THICKNESS_M;
  if (typeof out.heightM !== "number") out.heightM = DEFAULT_WALL_HEIGHT_M;
  if (typeof out.bottomElevationM !== "number") out.bottomElevationM = 0;
  if (!Array.isArray(out.openings)) out.openings = [];
  return out;
}
