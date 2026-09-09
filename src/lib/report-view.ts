/**
 * Pure builder for the read-only report view model + a print-friendly HTML
 * renderer, driven entirely by an immutable ReportSnapshot (never live data).
 * Escapes all user text. Supports hide-prices / hide-customer-fields for share
 * links. See override §8. Original code.
 */
import type { ReportSnapshot } from "./report-snapshot";
import { formatThickness } from "./thickness";

export interface ReportViewOptions {
  hidePrices?: boolean;
  hideCustomerFields?: boolean;
  theme?: "light" | "dark";
  /** When true, omit interactive controls (for print/PDF). */
  print?: boolean;
}

function esc(s: string): string {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

export interface ExecutiveSummary {
  floors: number;
  wifiAps: number;
  bleDevices: number;
  uwbAnchors: number;
  totalBomQuantity: number;
  unverifiedProducts: boolean;
  fallbackPatterns: boolean;
  technologiesUsed: string[];
}

export function executiveSummary(snapshot: ReportSnapshot): ExecutiveSummary {
  return {
    floors: snapshot.floorCount,
    wifiAps: snapshot.technologyCounts.WIFI,
    bleDevices: snapshot.technologyCounts.BLE,
    uwbAnchors: snapshot.technologyCounts.UWB,
    totalBomQuantity: snapshot.bom.reduce((n, l) => n + l.quantity, 0),
    unverifiedProducts: snapshot.flags.hasUnverifiedProducts,
    fallbackPatterns: snapshot.flags.hasFallbackPatterns,
    technologiesUsed: snapshot.flags.technologiesUsed,
  };
}

/** Table of contents anchors present in the report (used for nav + PDF bookmarks). */
export function reportSections(snapshot: ReportSnapshot): { id: string; title: string }[] {
  const sections = [
    { id: "summary", title: "Executive summary" },
    { id: "assumptions", title: "Technical assumptions" },
    { id: "bom", title: "Bill of materials" },
    { id: "devices", title: "Device schedule" },
  ];
  for (const f of snapshot.scenarioSnapshot.floors) {
    sections.push({ id: `floor-${slug(f.name)}`, title: `Floor: ${f.name}` });
  }
  sections.push({ id: "sources", title: "Product & pattern sources" });
  sections.push({ id: "limitations", title: "Limitations & disclaimer" });
  return sections;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Render a self-contained, print-friendly HTML report from the snapshot. */
export function renderReportHtml(snapshot: ReportSnapshot, opts: ReportViewOptions = {}): string {
  const hidePrices = opts.hidePrices ?? false;
  const hideCustomer = opts.hideCustomerFields ?? false;
  const summary = executiveSummary(snapshot);
  const toc = reportSections(snapshot);

  const bomRows = groupBom(snapshot)
    .map(
      (line) =>
        `<tr><td>${esc(line.model)}</td><td>${esc(line.sku)}</td><td class="num">${line.quantity}</td>` +
        (hidePrices ? "" : `<td class="num">${line.unitPrice ?? "—"}</td>`) +
        `<td>${line.verified ? "verified" : "sample"}</td></tr>`,
    )
    .join("");

  const deviceRows = snapshot.scenarioSnapshot.floors
    .flatMap((f) =>
      f.accessPoints.map(
        (ap) =>
          `<tr><td>${esc(ap.name)}</td><td>${esc(f.name)}</td><td>${esc(ap.productId)}</td>` +
          `<td>${ap.position.x.toFixed(2)}, ${ap.position.y.toFixed(2)} m</td>` +
          `<td>${ap.mountingType} @ ${ap.mountingHeightM} m</td>` +
          `<td>${ap.radios
            .filter((r) => r.enabled)
            .map((r) => `${r.band}GHz`)
            .join(", ")}</td>` +
          `<td>${esc(ap.installStatus)}</td></tr>`,
      ),
    )
    .join("");

  const wallRows = snapshot.walls
    .map(
      (w) =>
        `<tr><td>${esc(w.floor)}</td><td>${esc(w.materialId)}</td>` +
        `<td>${formatThickness(w.thicknessM, "mm")} (${w.thicknessM.toFixed(3)} m)</td>` +
        `<td class="num">${w.openingCount}</td></tr>`,
    )
    .join("");

  const floorSections = snapshot.scenarioSnapshot.floors
    .map(
      (f) => `
    <section id="floor-${slug(f.name)}" class="floor">
      <h2>Floor: ${esc(f.name)}</h2>
      <div class="kv">
        <span><strong>Scale:</strong> ${f.plan?.metersPerPixel?.toFixed(4) ?? "—"} m/px</span>
        <span><strong>Ceiling:</strong> ${f.ceilingHeightM} m</span>
        <span><strong>Devices:</strong> ${f.accessPoints.length}</span>
        <span><strong>Walls:</strong> ${f.walls.length}</span>
      </div>
      <p class="muted">Heatmap snapshots for this floor are attached when captured at export time.</p>
    </section>`,
    )
    .join("");

  const bleSection = summary.bleDevices
    ? `<p><strong>BLE devices:</strong> ${summary.bleDevices}</p>`
    : "";
  const uwbSection = summary.uwbAnchors
    ? `<p><strong>UWB anchors:</strong> ${summary.uwbAnchors} — ranging accuracy is not guaranteed; see limitations.</p>`
    : "";

  const controls = opts.print
    ? ""
    : `<nav class="toc" aria-label="Contents"><strong>Contents</strong><ul>${toc
        .map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`)
        .join("")}</ul></nav>`;

  return `<!doctype html><html lang="${snapshot.config.locale}"><head><meta charset="utf-8"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${esc(snapshot.config.title)}</title>
<style>
 :root{color-scheme:${opts.theme === "dark" && !opts.print ? "dark" : "light"}}
 body{font-family:system-ui,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif;margin:0;background:#f4f5f7;color:#1a1f2b}
 .page{max-width:900px;margin:0 auto;background:#fff;padding:40px;box-shadow:0 1px 4px rgba(0,0,0,.1)}
 h1{font-size:24px;margin:0 0 4px} h2{font-size:16px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:32px}
 .banner{background:#fff4e5;border:1px solid #f0b429;padding:10px;border-radius:6px;font-size:12px;margin:12px 0}
 table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
 th,td{border:1px solid #ddd;padding:5px 8px;text-align:left} th{background:#f0f2f5}
 td.num,th.num{text-align:right}
 thead{display:table-header-group}
 tr{break-inside:avoid}
 .kv{display:flex;gap:20px;flex-wrap:wrap;font-size:13px;margin:6px 0}
 .muted{color:#666;font-size:11px}
 .toc{font-size:12px;margin:16px 0}
 .status{display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px}
 .pass{background:#e4f5e7;color:#1a7f37} .warn{background:#fdf3d7;color:#8a6d1a} .fail{background:#fce4e4;color:#b42318}
 footer{margin-top:24px;font-size:10px;color:#888;border-top:1px solid #eee;padding-top:8px}
 @page{margin:16mm}
 @media print{body{background:#fff}.page{box-shadow:none;max-width:none;padding:0}.toc{display:none}}
</style></head><body><div class="page">
 <h1>${esc(snapshot.config.title)}</h1>
 <div class="muted">Report ${esc(snapshot.reportId)} · rev ${esc(snapshot.scenarioRevision)} · generated ${esc(snapshot.generatedAt)} · by ${esc(snapshot.generatedBy)}</div>
 ${hideCustomer ? "" : `<div class="muted">Prepared by ${esc(snapshot.config.preparedBy)}${snapshot.config.company ? " · " + esc(snapshot.config.company) : ""}</div>`}
 <div class="banner">${esc(snapshot.config.disclaimer)}</div>
 ${controls}

 <section id="summary"><h2>Executive summary</h2>
   <div class="kv">
     <span><strong>Floors:</strong> ${summary.floors}</span>
     <span><strong>Wi-Fi APs:</strong> ${summary.wifiAps}</span>
     <span><strong>BOM qty:</strong> ${summary.totalBomQuantity}</span>
     <span><strong>Technologies:</strong> ${summary.technologiesUsed.join(", ") || "—"}</span>
   </div>
   ${bleSection}${uwbSection}
   <p>${summary.unverifiedProducts ? '<span class="status warn">! Unverified product data present</span>' : '<span class="status pass">✓ Product data</span>'}
      ${summary.fallbackPatterns ? '<span class="status warn">! Generic fallback antenna pattern(s) used</span>' : ""}</p>
 </section>

 <section id="assumptions"><h2>Technical assumptions</h2>
   <div class="kv">
     <span><strong>RF engine:</strong> ${esc(snapshot.rfEngineVersion)}</span>
     <span><strong>Catalog:</strong> ${esc(snapshot.catalogDataVersion)}</span>
     <span><strong>Grid:</strong> ${snapshot.calculation.gridResolutionM} m</span>
     <span><strong>Environment:</strong> ${esc(snapshot.calculation.environment)}</span>
     <span><strong>Regulatory:</strong> ${esc(snapshot.flags.regulatoryDomain)}</span>
   </div>
   <h3 style="font-size:13px">Wall materials &amp; thickness</h3>
   <table><thead><tr><th>Floor</th><th>Material</th><th>Thickness</th><th class="num">Openings</th></tr></thead>
   <tbody>${wallRows || '<tr><td colspan="4" class="muted">No walls in this scenario.</td></tr>'}</tbody></table>
 </section>

 <section id="bom"><h2>Bill of materials</h2>
   <table><thead><tr><th>Model</th><th>SKU</th><th class="num">Qty</th>${hidePrices ? "" : '<th class="num">Unit price</th>'}<th>Data</th></tr></thead>
   <tbody>${bomRows || '<tr><td colspan="5" class="muted">No devices.</td></tr>'}</tbody></table>
   ${hidePrices ? '<p class="muted">Prices hidden for this shared view.</p>' : '<p class="muted">Prices, when present, may require supplier verification.</p>'}
 </section>

 <section id="devices"><h2>Device schedule</h2>
   <table><thead><tr><th>Name</th><th>Floor</th><th>Model</th><th>Position</th><th>Mounting</th><th>Bands</th><th>Status</th></tr></thead>
   <tbody>${deviceRows || '<tr><td colspan="7" class="muted">No devices.</td></tr>'}</tbody></table>
 </section>

 ${floorSections}

 <section id="sources"><h2>Product &amp; pattern sources</h2>
   <p class="muted">Catalog data version ${esc(snapshot.catalogDataVersion)}. Cisco specifications are
   sample/unverified unless a verified source is recorded. Verify with official Cisco documentation.</p>
 </section>

 <section id="limitations"><h2>Limitations &amp; disclaimer</h2>
   <p class="muted">${esc(snapshot.config.disclaimer)}</p>
   ${summary.uwbAnchors ? '<p class="muted">UWB: signal-strength prediction does not imply centimeter-level positioning accuracy; a site validation is required.</p>' : ""}
 </section>

 <footer>Report ${esc(snapshot.reportId)} · ${esc(snapshot.generatedAt)} · read-only</footer>
</div></body></html>`;
}

function groupBom(snapshot: ReportSnapshot) {
  // The BOM lines already carry model/sku/quantity/verified; unit price is
  // optional metadata that is not invented here (left as undefined).
  return snapshot.bom.map((l) => ({ ...l, unitPrice: undefined as number | undefined }));
}
