/**
 * Scenario metrics + BOM derivation. Pure functions used by comparison and
 * exports so the BOM always matches the selected scenario. See requirements.md §J,K.
 */
import type { Project, Scenario } from "@/domain/model";
import { getProduct } from "@/catalog";

export interface BomLine {
  productId: string;
  model: string;
  sku: string;
  quantity: number;
  verified: boolean;
}

export function scenarioApCount(scn: Scenario): number {
  return scn.floors.reduce((n, f) => n + f.accessPoints.length, 0);
}

export function scenarioFloorCount(scn: Scenario): number {
  return scn.floors.length;
}

export function scenarioBom(scn: Scenario): BomLine[] {
  const counts = new Map<string, number>();
  for (const floor of scn.floors) {
    for (const ap of floor.accessPoints) {
      counts.set(ap.productId, (counts.get(ap.productId) ?? 0) + 1);
    }
  }
  const lines: BomLine[] = [];
  for (const [productId, quantity] of counts) {
    const product = getProduct(productId);
    lines.push({
      productId,
      model: product?.model ?? productId,
      sku: product?.sku ?? "UNKNOWN",
      quantity,
      verified: product?.verified ?? false,
    });
  }
  return lines.sort((a, b) => (a.model < b.model ? -1 : 1));
}

export interface ScenarioSummary {
  id: string;
  name: string;
  isBaseline: boolean;
  apCount: number;
  floorCount: number;
  bomLines: number;
  radiosEnabled: number;
}

export function summarizeScenario(scn: Scenario): ScenarioSummary {
  let radiosEnabled = 0;
  for (const f of scn.floors) {
    for (const ap of f.accessPoints) {
      radiosEnabled += ap.radios.filter((r) => r.enabled).length;
    }
  }
  return {
    id: scn.id,
    name: scn.name,
    isBaseline: scn.isBaseline,
    apCount: scenarioApCount(scn),
    floorCount: scenarioFloorCount(scn),
    bomLines: scenarioBom(scn).length,
    radiosEnabled,
  };
}

export function allScenarioSummaries(project: Project): ScenarioSummary[] {
  return project.scenarios.map(summarizeScenario);
}
