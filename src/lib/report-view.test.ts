import { describe, it, expect } from "vitest";
import { renderReportHtml, executiveSummary, reportSections } from "./report-view";
import { buildReportSnapshot, type CalculationSettings } from "./report-snapshot";
import { createProject, createScenario, createFloor, createAccessPoint } from "@/domain/factory";

const calc: CalculationSettings = {
  gridResolutionM: 0.5,
  bands: ["2.4", "5", "6"],
  environment: "office",
  noiseFloorDbm: { "2.4": -95, "5": -92, "6": -92 },
  efficiencyFactor: 0.5,
};

function snap(withPrice = false) {
  const project = createProject("View Test", "org1", "user1");
  const floor = createFloor(0);
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 1, y: 1 }));
  floor.accessPoints.push(createAccessPoint("cat9166", { x: 5, y: 1 }));
  floor.walls.push({
    id: "w1",
    polyline: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    materialId: "concrete",
    thicknessM: 0.2,
    heightM: 2.7,
    bottomElevationM: 0,
    openings: [],
  });
  const scn = createScenario("Baseline", [floor], true);
  project.scenarios = [scn];
  project.activeScenarioId = scn.id;
  void withPrice;
  return buildReportSnapshot(project, scn, { title: "View Report" }, calc, {
    now: "t",
    reportId: "RPT-V",
  });
}

describe("report view (mandatory)", () => {
  it("Wi-Fi-only report omits BLE and UWB sections", () => {
    const html = renderReportHtml(snap());
    expect(html).not.toContain("UWB anchors");
    expect(html).not.toContain("BLE devices");
  });

  it("shows the correct floor and AP counts + wall thickness", () => {
    const html = renderReportHtml(snap());
    expect(html).toContain("<strong>Floors:</strong> 1");
    expect(html).toContain("<strong>Wi-Fi APs:</strong> 2");
    expect(html).toContain("200 mm"); // 0.2 m wall thickness
  });

  it("hide-prices report does not include a price column", () => {
    const html = renderReportHtml(snap(), { hidePrices: true });
    expect(html).not.toContain("Unit price");
    expect(html).toContain("Prices hidden");
  });

  it("print mode omits interactive navigation controls", () => {
    const html = renderReportHtml(snap(), { print: true });
    expect(html).not.toContain('class="toc"');
  });

  it("includes the predictive disclaimer and noindex", () => {
    const html = renderReportHtml(snap());
    expect(html).toContain("on-site survey");
    expect(html).toContain("noindex");
  });

  it("executiveSummary and sections reflect the snapshot", () => {
    const s = snap();
    const es = executiveSummary(s);
    expect(es.wifiAps).toBe(2);
    expect(es.bleDevices).toBe(0);
    expect(reportSections(s).some((x) => x.id === "bom")).toBe(true);
  });

  it("escapes user-provided text (XSS) in the title", () => {
    const s = snap();
    s.config.title = "<script>alert(1)</script>";
    const html = renderReportHtml(s);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
