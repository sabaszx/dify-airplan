/**
 * Model-specific antenna-pattern selection with a strict fallback hierarchy.
 * See override §4. A directional antenna is NEVER silently treated as
 * omnidirectional, and a generic fallback is always flagged.
 *
 * Hierarchy (best first):
 *   1. Exact model + SKU + radio + antenna + mounting + orientation + frequency
 *   2. Exact model + radio + antenna + frequency
 *   3. Product-family verified pattern
 *   4. Manufacturer simplified spec (from catalog antenna fields)
 *   5. Explicitly labeled generic fallback
 */
import type { AntennaPattern } from "./schema";
import type { ApProduct } from "@/catalog/schema";
import { PATTERN_LIBRARY, genericFallbackPattern } from "./library";
import type { Band } from "@/rf/pathloss";

export type SelectionTier =
  | "exact-sku"
  | "exact-model"
  | "family"
  | "manufacturer-spec"
  | "generic-fallback";

export interface PatternSelection {
  pattern: AntennaPattern;
  tier: SelectionTier;
  isFallback: boolean;
  fallbackReason?: string;
  warning?: string;
}

export interface SelectionQuery {
  product: ApProduct;
  band: Band;
  antenna: "integrated" | "external";
  mountingMode: "ceiling" | "wall" | "pole" | "outdoor";
  orientation: "horizontal" | "vertical";
}

const FALLBACK_WARNING =
  "No verified model-specific antenna pattern is available. The simulation is using a simplified fallback pattern.";

/** Extract a 3-digit model series (e.g. "916" from "Catalyst 9166") for
 *  conservative family grouping. Returns null when no 4-digit model is found. */
function familySeries(model: string): string | null {
  const m = model.match(/(\d{4})/);
  return m ? m[1]!.slice(0, 3) : null;
}

export function selectPattern(q: SelectionQuery): PatternSelection {
  const { product, band, antenna } = q;

  // Tier 1/2: model-specific library keyed by model|band|antenna.
  const exactKey = `${product.model}|${band}|${antenna}`;
  const exact = PATTERN_LIBRARY[exactKey];
  if (exact) {
    return { pattern: exact, tier: "exact-model", isFallback: false };
  }

  // Tier 2 relaxation: same model, other antenna type present.
  const altKey = `${product.model}|${band}|${antenna === "integrated" ? "external" : "integrated"}`;
  const alt = PATTERN_LIBRARY[altKey];
  if (alt) {
    return {
      pattern: alt,
      tier: "exact-model",
      isFallback: false,
      warning: `Using the ${antenna === "integrated" ? "external" : "integrated"} antenna pattern for this model; no ${antenna} pattern is registered.`,
    };
  }

  // Tier 3: product-family pattern. Match only when a registered pattern's model
  // shares the same family SERIES number (e.g. "91" for Catalyst 9166 vs 9164),
  // to avoid over-matching every model in a broad family label.
  const series = familySeries(product.model);
  if (series) {
    const familyEntry = Object.entries(PATTERN_LIBRARY).find(([key, pat]) => {
      return (
        key.endsWith(`|${band}|${antenna}`) &&
        pat.manufacturer === product.manufacturer &&
        familySeries(pat.model) === series
      );
    });
    if (familyEntry) {
      return {
        pattern: familyEntry[1],
        tier: "family",
        isFallback: false,
        warning: "Using a product-family pattern (no exact model pattern registered).",
      };
    }
  }

  // Tier 4: manufacturer simplified spec from the catalog antenna fields.
  const directional = product.antenna.pattern === "directional";
  const specPattern = genericFallbackPattern(band, directional, product.antenna.gainDbi);
  specPattern.id = `${product.model}-spec-${band}`;
  specPattern.model = product.model;
  specPattern.verificationStatus = "sample";
  // This is derived from the catalog's simplified antenna spec — still a fallback
  // relative to a measured pattern, so it is flagged.
  return {
    pattern: specPattern,
    tier: "manufacturer-spec",
    isFallback: true,
    fallbackReason:
      "Derived from the catalog's simplified antenna specification, not a measured model pattern.",
    warning: FALLBACK_WARNING,
  };
}

/** Absolute-last-resort generic fallback (used when no product context). */
export function genericSelection(
  band: Band,
  directional: boolean,
  peakGainDbi = 4,
): PatternSelection {
  return {
    pattern: genericFallbackPattern(band, directional, peakGainDbi),
    tier: "generic-fallback",
    isFallback: true,
    fallbackReason: "No product context available.",
    warning: FALLBACK_WARNING,
  };
}
