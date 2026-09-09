/**
 * Catalog loader. Validates the seeded JSON against the Zod schema so malformed
 * data fails fast. The CatalogImporter interface allows future imports from
 * official Cisco datasheets (verified data) without changing UI logic.
 */
import raw from "./cisco-aps.json";
import { CatalogSchema, type Catalog, type ApProduct } from "./schema";

let cached: Catalog | null = null;

export function loadCatalog(): Catalog {
  if (!cached) {
    cached = CatalogSchema.parse(raw);
  }
  return cached;
}

export function getProduct(id: string): ApProduct | undefined {
  return loadCatalog().products.find((p) => p.id === id);
}

export function productsByGeneration(): Record<string, ApProduct[]> {
  const groups: Record<string, ApProduct[]> = {};
  for (const p of loadCatalog().products) {
    (groups[p.wifiGeneration] ??= []).push(p);
  }
  return groups;
}

/** Interface for future verified-data imports (adapter, design.md §1). */
export interface CatalogImporter {
  import(source: string): Promise<Catalog>;
}

export type { ApProduct, Catalog };
