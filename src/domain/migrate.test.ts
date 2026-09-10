import { describe, it, expect } from "vitest";
import { migrateProject, DEFAULT_WALL_THICKNESS_M, DEFAULT_WALL_HEIGHT_M } from "./migrate";
import { ProjectSchema } from "./model";
import { createProject } from "./factory";

/** A minimal legacy project shaped like an older schema (no thickness/hierarchy). */
function legacyProject(): unknown {
  return {
    id: "proj_legacy",
    organizationId: "org1",
    ownerId: "user1",
    name: "Legacy",
    customer: "",
    location: "",
    regulatoryDomain: "US",
    allowDfs: false,
    unit: "m",
    locale: "en",
    materials: [
      { id: "concrete", name: "Concrete", attenuationDb: { "2.4": 12, "5": 15, "6": 17 } },
    ],
    thresholds: {
      dataRssiDbm: -67,
      voiceRssiDbm: -65,
      highDensityRssiDbm: -62,
      minSnrDb: 25,
      minSecondaryRssiDbm: -72,
      maxClientsPerAp: 30,
      minThroughputMbps: 25,
    },
    scenarios: [
      {
        id: "scn1",
        name: "Current",
        isBaseline: true,
        floors: [
          {
            id: "floor1",
            name: "Floor 1",
            index: 0,
            ceilingHeightM: 3,
            plan: null,
            walls: [
              // Legacy wall: only polyline + material, NO thickness/height/openings.
              {
                id: "w1",
                polyline: [
                  { x: 0, y: 0 },
                  { x: 5, y: 0 },
                ],
                materialId: "concrete",
              },
            ],
            accessPoints: [],
            requirements: [],
          },
        ],
      },
    ],
    activeScenarioId: "scn1",
    archived: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("project migration (backward compatible, mandatory §8)", () => {
  it("gives legacy walls a documented default thickness/height/openings", () => {
    const migrated = migrateProject(legacyProject()) as {
      scenarios: {
        floors: { walls: { thicknessM: number; heightM: number; openings: unknown[] }[] }[];
      }[];
    };
    const wall = migrated.scenarios[0]!.floors[0]!.walls[0]!;
    expect(wall.thicknessM).toBe(DEFAULT_WALL_THICKNESS_M);
    expect(wall.heightM).toBe(DEFAULT_WALL_HEIGHT_M);
    expect(wall.openings).toEqual([]);
  });

  it("places legacy floors under a default building with explicit order + elevation", () => {
    const migrated = migrateProject(legacyProject()) as {
      scenarios: {
        buildings: { floorIds: string[] }[];
        floors: { sortOrder: number; baseElevationM: number; floorNumber: number }[];
      }[];
    };
    const scn = migrated.scenarios[0]!;
    expect(scn.buildings).toHaveLength(1);
    expect(scn.buildings[0]!.floorIds).toContain("floor1");
    expect(scn.floors[0]!.sortOrder).toBe(0);
    expect(scn.floors[0]!.floorNumber).toBe(1);
    expect(typeof scn.floors[0]!.baseElevationM).toBe("number");
  });

  it("stamps materials with a version and archived flag", () => {
    const migrated = migrateProject(legacyProject()) as {
      materials: { version: number; archived: boolean }[];
    };
    expect(migrated.materials[0]!.version).toBe(1);
    expect(migrated.materials[0]!.archived).toBe(false);
  });

  it("a migrated legacy project validates against the current schema", () => {
    const migrated = migrateProject(legacyProject());
    const parsed = ProjectSchema.safeParse(migrated);
    expect(parsed.success).toBe(true);
  });

  it("is idempotent and non-destructive on an already-current project", () => {
    const current = createProject("Now", "org1", "user1");
    const once = migrateProject(JSON.parse(JSON.stringify(current)));
    const twice = migrateProject(JSON.parse(JSON.stringify(once)));
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    // Existing data preserved.
    expect((once as { name: string }).name).toBe("Now");
  });
});
