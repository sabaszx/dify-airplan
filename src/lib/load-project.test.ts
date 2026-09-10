import { describe, it, expect, beforeEach } from "vitest";
import { loadValidatedProject } from "./load-project";
import { localProjectStore } from "./storage";
import { createProject } from "@/domain/factory";

/** Minimal localStorage stub for the node test environment. */
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return store;
}

describe("resilient project loader (mandatory §7.2)", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installLocalStorage();
  });

  it("loads and validates a well-formed project", async () => {
    const p = createProject("Good", "org1", "user1");
    await localProjectStore.save(p);
    const res = await loadValidatedProject(p.id);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.project.name).toBe("Good");
  });

  it("returns not-found for a missing id", async () => {
    const res = await loadValidatedProject("does-not-exist");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-found");
  });

  it("returns a typed corrupted result for malformed persisted state (no crash)", async () => {
    // Write a broken record directly into the store map.
    store.set("cwp:projects", JSON.stringify({ bad: { id: "bad", name: 123 } }));
    const res = await loadValidatedProject("bad");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("corrupted");
  });

  it("migrates a legacy project (missing wall thickness) so it loads", async () => {
    store.set(
      "cwp:projects",
      JSON.stringify({
        legacy: {
          id: "legacy",
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
                  id: "f1",
                  name: "Floor 1",
                  index: 0,
                  ceilingHeightM: 3,
                  plan: null,
                  walls: [
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
        },
      }),
    );
    const res = await loadValidatedProject("legacy");
    expect(res.ok).toBe(true);
    if (res.ok) {
      const wall = res.project.scenarios[0]!.floors[0]!.walls[0]!;
      expect(wall.thicknessM).toBeGreaterThan(0);
    }
  });
});
