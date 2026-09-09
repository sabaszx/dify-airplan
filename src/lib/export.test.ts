import { describe, it, expect } from "vitest";
import { bomCsv, apInventoryCsv, reportHtml } from "./export";
import { scenarioBom, scenarioApCount } from "./scenario-metrics";
import { createProject, createScenario, createFloor, createAccessPoint } from "@/domain/factory";
import { activeScenario } from "@/store/editor";

function projectWithAps() {
  const project = createProject("Export Test", "org1", "user1");
  const floor = createFloor(0);
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 1, y: 1 }));
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 5, y: 1 }));
  floor.accessPoints.push(createAccessPoint("cat9130", { x: 9, y: 1 }));
  const scn = createScenario("Option A", [floor], true);
  project.scenarios = [scn];
  project.activeScenarioId = scn.id;
  return project;
}

describe("exports (mandatory: BOM matches scenario)", () => {
  it("BOM quantities match AP counts in the selected scenario", () => {
    const project = projectWithAps();
    const scn = activeScenario(project);
    const bom = scenarioBom(scn);
    const total = bom.reduce((n, l) => n + l.quantity, 0);
    expect(total).toBe(scenarioApCount(scn));
    const cat9166 = bom.find((l) => l.productId === "cat9166");
    expect(cat9166?.quantity).toBe(2);
  });

  it("BOM CSV flags unverified sample data", () => {
    const scn = activeScenario(projectWithAps());
    expect(bomCsv(scn)).toContain("NO (sample)");
  });

  it("AP inventory CSV lists every AP", () => {
    const scn = activeScenario(projectWithAps());
    const csv = apInventoryCsv(scn);
    const dataLines = csv.split("\n").length - 1; // minus header
    expect(dataLines).toBe(3);
  });

  it("report HTML contains correct floor and AP count (mandatory)", () => {
    const project = projectWithAps();
    const scn = activeScenario(project);
    const html = reportHtml(project, scn);
    expect(html).toContain("<strong>Floors:</strong> 1");
    expect(html).toContain("<strong>Access points:</strong> 3");
    expect(html).toContain("on-site survey");
  });
});
