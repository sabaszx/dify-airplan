import { describe, it, expect } from "vitest";
import { buildReportSnapshot, serializeReportSnapshot, RF_ENGINE_VERSION } from "./report-snapshot";
import { createProject, createScenario, createFloor, createAccessPoint } from "@/domain/factory";
import { scenarioApCount } from "./scenario-metrics";
import type { CalculationSettings } from "./report-snapshot";

const calc: CalculationSettings = {
  gridResolutionM: 0.5,
  bands: ["2.4", "5", "6"],
  environment: "office",
  noiseFloorDbm: { "2.4": -95, "5": -92, "6": -92 },
  efficiencyFactor: 0.5,
};

function projectWithAps() {
  const project = createProject("Report Test", "org1", "user1");
  const floor = createFloor(0);
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 1, y: 1 }));
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 5, y: 1 }));
  floor.accessPoints.push(createAccessPoint("cat9105", { x: 9, y: 1 })); // no library pattern -> fallback
  const scn = createScenario("Baseline", [floor], true);
  project.scenarios = [scn];
  project.activeScenarioId = scn.id;
  return { project, scn };
}

describe("report snapshot traceability", () => {
  it("captures engine/catalog/project/scenario revisions and timestamp", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, {
      now: "2026-03-03T00:00:00Z",
      reportId: "RPT-TEST-1",
    });
    expect(snap.reportId).toBe("RPT-TEST-1");
    expect(snap.generatedAt).toBe("2026-03-03T00:00:00Z");
    expect(snap.rfEngineVersion).toBe(RF_ENGINE_VERSION);
    expect(snap.catalogDataVersion).toBeTruthy();
    expect(snap.projectRevision).toBe(project.updatedAt);
    expect(snap.calculation.gridResolutionM).toBe(0.5);
  });

  it("report totals match the selected scenario snapshot (mandatory)", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    const bomTotal = snap.bom.reduce((n, l) => n + l.quantity, 0);
    expect(snap.apCount).toBe(scenarioApCount(scn));
    expect(bomTotal).toBe(snap.apCount);
    expect(snap.floorCount).toBe(1);
  });

  it("flags unverified products and fallback patterns", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    // Seeded catalog is all sample/unverified.
    expect(snap.flags.hasUnverifiedProducts).toBe(true);
    // cat9130 has no registered library pattern -> fallback used.
    expect(snap.patterns.some((p) => p.isFallback)).toBe(true);
  });

  it("records per-product datasheet URLs and revisions for provenance", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    for (const p of snap.products) {
      expect(p.productRevisionId).toBeTruthy();
      expect(typeof p.datasheetUrl).toBe("string");
    }
  });

  it("remains reproducible from the embedded scenario snapshot even if live data changes", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    const serialized = serializeReportSnapshot(snap);

    // Mutate the LIVE scenario after the snapshot was taken.
    scn.floors[0]!.accessPoints.push(createAccessPoint("cat9166", { x: 20, y: 20 }));

    // The serialized snapshot is unchanged and still reflects the original 3 APs.
    const restored = JSON.parse(serialized);
    expect(restored.apCount).toBe(3);
    const restoredAps = restored.scenarioSnapshot.floors[0].accessPoints.length;
    expect(restoredAps).toBe(3);
  });

  it("includes the predictive disclaimer by default", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    expect(snap.config.disclaimer).toContain("on-site survey");
  });

  it("wall thickness in the snapshot matches project data (mandatory)", () => {
    const { project, scn } = projectWithAps();
    // Add a wall with a specific thickness.
    scn.floors[0]!.walls.push({
      id: "w1",
      polyline: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      materialId: "concrete",
      thicknessM: 0.25,
      heightM: 2.7,
      bottomElevationM: 0,
      openings: [],
    });
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    expect(snap.walls).toHaveLength(1);
    expect(snap.walls[0]!.thicknessM).toBe(0.25);
    expect(snap.walls[0]!.materialId).toBe("concrete");
  });

  it("Wi-Fi-only project reports no BLE/UWB devices (mandatory)", () => {
    const { project, scn } = projectWithAps();
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    expect(snap.technologyCounts.WIFI).toBeGreaterThan(0);
    expect(snap.technologyCounts.BLE).toBe(0);
    expect(snap.technologyCounts.UWB).toBe(0);
    expect(snap.flags.technologiesUsed).toEqual(["WIFI"]);
  });

  it("captures material attenuation assumptions (models when present)", () => {
    const { project, scn } = projectWithAps();
    project.materials = project.materials.map((m) =>
      m.id === "concrete"
        ? {
            ...m,
            models: { "5": { kind: "per-thickness", fixedDb: 0, baseDb: 0, lossPerMeterDb: 50 } },
          }
        : m,
    );
    const snap = buildReportSnapshot(project, scn, {}, calc, { now: "t" });
    const concrete = snap.materials.find((m) => m.id === "concrete");
    expect(concrete?.models?.["5"]?.kind).toBe("per-thickness");
  });
});
