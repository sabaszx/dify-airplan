/**
 * Export helpers: CSV (AP inventory, BOM), JSON (project, placement), and a
 * printable HTML report (rendered to PDF via the browser print pipeline, which
 * keeps the MVP dependency-free while the PdfRenderer adapter allows swapping in
 * a server-side renderer later). See requirements.md §K.
 */
import type { Project, Scenario } from "@/domain/model";
import { getProduct } from "@/catalog";
import { scenarioBom, scenarioApCount, scenarioFloorCount } from "./scenario-metrics";

const DISCLAIMER =
  "Predictive estimates only. Validate the final design with an on-site survey and applicable regulatory requirements. Cisco product specifications shown are SAMPLE / UNVERIFIED — verify with official Cisco documentation.";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  return lines.join("\n");
}

export function apInventoryCsv(scn: Scenario): string {
  const headers = [
    "Floor",
    "AP Name",
    "Model",
    "SKU",
    "X (m)",
    "Y (m)",
    "Mounting",
    "Height (m)",
    "Asset Tag",
    "Switch",
    "Port",
    "IP",
    "Status",
  ];
  const rows: unknown[][] = [];
  for (const floor of scn.floors) {
    for (const ap of floor.accessPoints) {
      const product = getProduct(ap.productId);
      rows.push([
        floor.name,
        ap.name,
        product?.model ?? ap.productId,
        product?.sku ?? "",
        ap.position.x.toFixed(2),
        ap.position.y.toFixed(2),
        ap.mountingType,
        ap.mountingHeightM,
        ap.assetTag ?? "",
        ap.switchName ?? "",
        ap.switchPort ?? "",
        ap.ipAddress ?? "",
        ap.installStatus,
      ]);
    }
  }
  return toCsv(headers, rows);
}

export function bomCsv(scn: Scenario): string {
  const headers = ["Model", "SKU", "Quantity", "Data Verified"];
  const rows = scenarioBom(scn).map((l) => [
    l.model,
    l.sku,
    l.quantity,
    l.verified ? "yes" : "NO (sample)",
  ]);
  return toCsv(headers, rows);
}

export function projectJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function placementJson(scn: Scenario): string {
  const placement = scn.floors.map((f) => ({
    floor: f.name,
    metersPerPixel: f.plan?.metersPerPixel ?? null,
    accessPoints: f.accessPoints.map((ap) => ({
      name: ap.name,
      productId: ap.productId,
      position: ap.position,
      rotationDeg: ap.rotationDeg,
      mountingHeightM: ap.mountingHeightM,
    })),
    walls: f.walls.map((w) => ({ materialId: w.materialId, polyline: w.polyline })),
  }));
  return JSON.stringify({ scenario: scn.name, placement }, null, 2);
}

/** Build a self-contained printable HTML report. */
export function reportHtml(project: Project, scn: Scenario, heatmapImages: string[] = []): string {
  const bom = scenarioBom(scn);
  const apCount = scenarioApCount(scn);
  const floorCount = scenarioFloorCount(scn);
  const apRows = scn.floors
    .flatMap((f) =>
      f.accessPoints.map(
        (ap) =>
          `<tr><td>${f.name}</td><td>${esc(ap.name)}</td><td>${esc(
            getProduct(ap.productId)?.model ?? ap.productId,
          )}</td><td>${ap.radios
            .filter((r) => r.enabled)
            .map((r) => `${r.band}GHz`)
            .join(", ")}</td></tr>`,
      ),
    )
    .join("");
  const bomRows = bom
    .map(
      (l) =>
        `<tr><td>${esc(l.model)}</td><td>${esc(l.sku)}</td><td>${l.quantity}</td><td>${
          l.verified ? "yes" : "NO (sample)"
        }</td></tr>`,
    )
    .join("");
  const images = heatmapImages
    .map(
      (src, i) =>
        `<figure><img src="${src}" alt="Heatmap ${i + 1}"/><figcaption>Heatmap ${i + 1}</figcaption></figure>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>${esc(project.name)} — Design Report</title>
<style>
 body{font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#1a1f2b;margin:32px;line-height:1.4}
 h1{font-size:22px} h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}
 table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
 th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}
 .banner{background:#fff4e5;border:1px solid #f0b429;padding:10px;border-radius:6px;font-size:12px}
 .kv{display:flex;gap:24px;flex-wrap:wrap;font-size:13px}
 figure{margin:8px 0} img{max-width:100%;border:1px solid #ccc}
 .muted{color:#666;font-size:11px}
</style></head><body>
 <h1>${esc(project.name)} — Wi-Fi Design Report</h1>
 <div class="banner"><strong>Notice:</strong> ${DISCLAIMER}</div>
 <h2>Project &amp; Customer</h2>
 <div class="kv">
   <div><strong>Customer:</strong> ${esc(project.customer || "—")}</div>
   <div><strong>Location:</strong> ${esc(project.location || "—")}</div>
   <div><strong>Scenario:</strong> ${esc(scn.name)}</div>
   <div><strong>Regulatory domain:</strong> ${esc(project.regulatoryDomain)}</div>
   <div><strong>Floors:</strong> ${floorCount}</div>
   <div><strong>Access points:</strong> ${apCount}</div>
 </div>
 <h2>Design Assumptions</h2>
 <ul class="muted">
   <li>Log-distance path loss, office exponent, per-band wall attenuation (planning defaults).</li>
   <li>Thresholds: data ${project.thresholds.dataRssiDbm} dBm, min SNR ${project.thresholds.minSnrDb} dB.</li>
   <li>Capacity and PHY/throughput values are estimates from configurable lookup tables.</li>
 </ul>
 <h2>Heatmap Snapshots</h2>
 ${images || '<p class="muted">No heatmap snapshots were captured for this export.</p>'}
 <h2>Access Point Configuration</h2>
 <table><thead><tr><th>Floor</th><th>AP</th><th>Model</th><th>Enabled bands</th></tr></thead><tbody>${apRows}</tbody></table>
 <h2>Bill of Materials</h2>
 <table><thead><tr><th>Model</th><th>SKU</th><th>Qty</th><th>Data verified</th></tr></thead><tbody>${bomRows}</tbody></table>
 <h2>Product Data Sources</h2>
 <p class="muted">Catalog data version: ${esc(project.materials.length ? "sample-0.1.0" : "n/a")}.
 All Cisco specifications are sample/unverified placeholders. Verify with official Cisco documentation before use.</p>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
