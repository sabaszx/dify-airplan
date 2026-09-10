import { describe, it, expect, beforeEach } from "vitest";
import { loadValidatedProject } from "./load-project";
import { localProjectStore } from "./storage";
import { activeScenario } from "@/store/editor";
import { buildReportSnapshot, type CalculationSettings } from "./report-snapshot";
import { renderReportHtml } from "./report-view";
import { createProject, createAccessPoint } from "@/domain/factory";

/**
 * Regression tests for the client-side report exception. The report route builds
 * a snapshot and renders HTML from a loaded project. Previously an unguarded
 * throw (missing/corrupted data) produced an unhandled client exception. These
 * assert the data path yields either valid HTML or a typed error — never a throw.
 */
const CALC: CalculationSettings = {
  gridResolutionM: 0.5,
  bands: ["2.4", "5", "6"],
  environment: "office",
  noiseFloorDbm: { "2.4": -95, "5": -92, "6": -92 },
  efficiencyFactor: 0.5,
};

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

/** Mirror of the report route's data path (without React hooks). */
async function buildReportForRoute(id: string): Promise<{ html: string } | { error: string }> {
  const loaded = await loadValidatedProject(id);
  if (!loaded.ok) return { error: loaded.reason };
  const scn = activeScenario(loaded.project);
  const snapshot = buildReportSnapshot(loaded.project, scn, {}, CALC, { now: "t" });
  return { html: renderReportHtml(snapshot) };
}

describe("report route data path (client-exception regression)", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installLocalStorage();
  });

  it("renders HTML for a valid project with devices", async () => {
    const p = createProject("Report OK", "org1", "user1");
    activeScenario(p).floors[0]!.accessPoints.push(createAccessPoint("cat9166", { x: 2, y: 2 }));
    await localProjectStore.save(p);
    const res = await buildReportForRoute(p.id);
    expect("html" in res).toBe(true);
    if ("html" in res) expect(res.html).toContain("Wi-Fi APs");
  });

  it("returns a typed error (not a throw) for a missing project", async () => {
    await expect(buildReportForRoute("missing")).resolves.toEqual({ error: "not-found" });
  });

  it("returns a typed error (not a throw) for corrupted persisted state", async () => {
    store.set("cwp:projects", JSON.stringify({ bad: { id: "bad", name: 999 } }));
    await expect(buildReportForRoute("bad")).resolves.toEqual({ error: "corrupted" });
  });

  it("does not throw for a project with no floors accessed as a scenario", async () => {
    const p = createProject("Empty", "org1", "user1");
    await localProjectStore.save(p);
    const res = await buildReportForRoute(p.id);
    expect("html" in res).toBe(true);
  });
});
