/**
 * Reproducible report snapshot with full traceability. A snapshot captures every
 * input required to reproduce an exported report even if the live catalog,
 * patterns, or project change later. See override §6.3 and steering/reporting.md.
 *
 * Pure and unit-tested. The snapshot embeds a deep copy of the scenario and the
 * catalog entries actually used, plus revision ids and calculation settings.
 */
import type { Project, Scenario } from "@/domain/model";
import { getProduct, loadCatalog } from "@/catalog";
import { selectPattern } from "@/antenna/select";
import { scenarioBom, scenarioApCount, scenarioFloorCount, type BomLine } from "./scenario-metrics";
import type { Band } from "@/rf/pathloss";

/** Version of the deterministic RF engine used for calculations. */
export const RF_ENGINE_VERSION = "rf-engine-1.0.0";

export interface CalculationSettings {
  gridResolutionM: number;
  bands: Band[];
  environment: string;
  noiseFloorDbm: Record<Band, number>;
  efficiencyFactor: number;
}

export interface ProductUsage {
  productId: string;
  productRevisionId: string;
  model: string;
  sku: string;
  verified: boolean;
  datasheetUrl: string;
  quantity: number;
}

export interface PatternUsage {
  productId: string;
  band: Band;
  patternId: string;
  patternRevision: number;
  verificationStatus: string;
  isFallback: boolean;
  fallbackReason?: string;
}

export interface ReportConfig {
  title: string;
  preparedBy: string;
  company: string;
  unit: "m" | "ft";
  locale: "en" | "th";
  pageSize: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  disclaimer: string;
}

export interface ReportSnapshot {
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  rfEngineVersion: string;
  catalogDataVersion: string;
  projectId: string;
  projectRevision: string; // project.updatedAt acts as a revision marker
  scenarioId: string;
  scenarioName: string;
  scenarioRevision: string;
  config: ReportConfig;
  calculation: CalculationSettings;
  apCount: number;
  floorCount: number;
  /** Per-technology device counts (only techs actually used are non-zero). */
  technologyCounts: { WIFI: number; BLE: number; UWB: number };
  bom: BomLine[];
  products: ProductUsage[];
  patterns: PatternUsage[];
  /** Wall assumptions captured for reproducibility (thickness + attenuation). */
  walls: WallSummary[];
  materials: MaterialSummary[];
  /** Deep-frozen copy of the scenario so totals never drift from the live data. */
  scenarioSnapshot: Scenario;
  /** Flags surfaced in the report for transparency. */
  flags: {
    hasUnverifiedProducts: boolean;
    hasFallbackPatterns: boolean;
    regulatoryDomain: string;
    technologiesUsed: string[];
  };
}

export interface WallSummary {
  floor: string;
  materialId: string;
  thicknessM: number;
  openingCount: number;
}

export interface MaterialSummary {
  id: string;
  name: string;
  attenuationDb: { "2.4": number; "5": number; "6": number };
  models?: Record<
    string,
    { kind: string; fixedDb: number; baseDb: number; lossPerMeterDb: number }
  >;
}

export const DEFAULT_DISCLAIMER =
  "Predictive RF results are estimates based on the selected model, antenna data, floor-plan scale, wall attenuation, environmental assumptions, and client characteristics. Validate the final deployment through an on-site survey and applicable regulatory requirements.";

function usedProducts(scn: Scenario): ProductUsage[] {
  const counts = new Map<string, number>();
  for (const f of scn.floors)
    for (const ap of f.accessPoints) {
      counts.set(ap.productId, (counts.get(ap.productId) ?? 0) + 1);
    }
  const out: ProductUsage[] = [];
  for (const [productId, quantity] of counts) {
    const p = getProduct(productId);
    out.push({
      productId,
      productRevisionId: p?.productRevisionId ?? p?.catalogDataVersion ?? "unknown",
      model: p?.model ?? productId,
      sku: p?.sku ?? "unknown",
      verified: p?.verified ?? false,
      datasheetUrl: p?.datasheetUrl ?? "",
      quantity,
    });
  }
  return out.sort((a, b) => (a.model < b.model ? -1 : 1));
}

function usedPatterns(scn: Scenario, allowDfs: boolean): PatternUsage[] {
  const seen = new Set<string>();
  const out: PatternUsage[] = [];
  for (const f of scn.floors) {
    for (const ap of f.accessPoints) {
      const product = getProduct(ap.productId);
      if (!product) continue;
      for (const radio of ap.radios) {
        if (!radio.enabled) continue;
        const key = `${ap.productId}|${radio.band}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const sel = selectPattern({
          product,
          band: radio.band,
          antenna: product.antenna.integrated ? "integrated" : "external",
          mountingMode: ap.mountingType,
          orientation: ap.orientationAzimuthDegrees % 180 === 0 ? "horizontal" : "vertical",
        });
        out.push({
          productId: ap.productId,
          band: radio.band,
          patternId: sel.pattern.id,
          patternRevision: sel.pattern.revision,
          verificationStatus: sel.pattern.verificationStatus,
          isFallback: sel.isFallback,
          fallbackReason: sel.fallbackReason,
        });
      }
    }
  }
  void allowDfs;
  return out;
}

let reportSeq = 0;

/**
 * Build a reproducible report snapshot. Deterministic given the same inputs and
 * `now`/`seq` (which are injected for testability).
 */
export function buildReportSnapshot(
  project: Project,
  scenario: Scenario,
  config: Partial<ReportConfig>,
  calculation: CalculationSettings,
  opts: { now?: string; generatedBy?: string; reportId?: string } = {},
): ReportSnapshot {
  const now = opts.now ?? new Date().toISOString();
  const reportId =
    opts.reportId ?? `RPT-${now.slice(0, 10)}-${(++reportSeq).toString().padStart(4, "0")}`;
  const bom = scenarioBom(scenario);
  const products = usedProducts(scenario);
  const patterns = usedPatterns(scenario, project.allowDfs);
  const technologyCounts = countTechnologies(scenario);
  const walls = summarizeWalls(scenario);
  const materials = project.materials.map((m) => ({
    id: m.id,
    name: m.name,
    attenuationDb: m.attenuationDb,
    models: m.models as MaterialSummary["models"],
  }));
  const technologiesUsed = (Object.entries(technologyCounts) as [string, number][])
    .filter(([, n]) => n > 0)
    .map(([t]) => t);

  const fullConfig: ReportConfig = {
    title: config.title ?? `${project.name} — Wi-Fi Design Report`,
    preparedBy: config.preparedBy ?? project.ownerId,
    company: config.company ?? "",
    unit: config.unit ?? project.unit,
    locale: config.locale ?? project.locale,
    pageSize: config.pageSize ?? "A4",
    orientation: config.orientation ?? "portrait",
    disclaimer: config.disclaimer ?? DEFAULT_DISCLAIMER,
  };

  return {
    reportId,
    generatedAt: now,
    generatedBy: opts.generatedBy ?? project.ownerId,
    rfEngineVersion: RF_ENGINE_VERSION,
    catalogDataVersion: loadCatalog().catalogDataVersion,
    projectId: project.id,
    projectRevision: project.updatedAt,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    scenarioRevision: `${scenario.id}@${project.updatedAt}`,
    config: fullConfig,
    calculation,
    apCount: scenarioApCount(scenario),
    floorCount: scenarioFloorCount(scenario),
    technologyCounts,
    bom,
    products,
    patterns,
    walls,
    materials,
    scenarioSnapshot: JSON.parse(JSON.stringify(scenario)) as Scenario,
    flags: {
      hasUnverifiedProducts: products.some((p) => !p.verified),
      hasFallbackPatterns: patterns.some((p) => p.isFallback),
      regulatoryDomain: project.regulatoryDomain,
      technologiesUsed,
    },
  };
}

/** Count devices per technology. A device supports a technology when the catalog
 *  product declares a radio for it (Wi-Fi from bands; BLE/UWB via catalog flags
 *  when present). Only techs actually in use will be non-zero. */
function countTechnologies(scn: Scenario): { WIFI: number; BLE: number; UWB: number } {
  const counts = { WIFI: 0, BLE: 0, UWB: 0 };
  for (const f of scn.floors) {
    for (const ap of f.accessPoints) {
      const product = getProduct(ap.productId);
      // Wi-Fi if any enabled Wi-Fi band radio exists.
      if (ap.radios.some((r) => r.enabled)) counts.WIFI++;
      // BLE/UWB counted only when the product explicitly advertises support
      // via pattern refs / notes (sample catalog has none, so these stay 0
      // unless a project opts a device into BLE/UWB).
      const hasBle = product?.patternRefs?.some((p) => p.patternId.toLowerCase().includes("ble"));
      const hasUwb = product?.patternRefs?.some((p) => p.patternId.toLowerCase().includes("uwb"));
      if (hasBle) counts.BLE++;
      if (hasUwb) counts.UWB++;
    }
  }
  return counts;
}

function summarizeWalls(scn: Scenario): WallSummary[] {
  const out: WallSummary[] = [];
  for (const f of scn.floors) {
    for (const w of f.walls) {
      out.push({
        floor: f.name,
        materialId: w.materialId,
        thicknessM: w.thicknessM,
        openingCount: w.openings.length,
      });
    }
  }
  return out;
}

/** Serialize a snapshot to a JSON string (report snapshot export). */
export function serializeReportSnapshot(snapshot: ReportSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}
