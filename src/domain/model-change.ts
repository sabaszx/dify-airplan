/**
 * AP model-change engine. Computes a compatibility summary before applying a
 * model change, then applies it, preserving compatible fields and resetting
 * unsupported ones. The whole replacement is applied by the caller as ONE
 * undoable command. See override §3. Pure and testable.
 */
import type { AccessPoint, Radio } from "./model";
import type { ApProduct } from "@/catalog/schema";
import type { Band } from "@/rf/pathloss";

export interface CompatibilitySummary {
  preserved: string[];
  converted: string[];
  reset: string[];
  radiosAdded: Band[];
  radiosRemoved: Band[];
  bandsAvailable: Band[];
  bandsUnavailable: Band[];
  antennaChange: string | null;
  regulatoryConflict: string | null;
  managementChange: string | null;
  hasBlockingReview: boolean;
}

/** Compute what will happen when `ap` changes from its current product to `next`. */
export function computeModelChange(
  ap: AccessPoint,
  currentProduct: ApProduct | undefined,
  next: ApProduct,
): CompatibilitySummary {
  const preserved: string[] = [
    "Canvas position",
    "Floor",
    "AP name",
    "Asset tag",
    "Installation notes",
    "Switch information",
    "Mounting height",
    "Mounting orientation",
  ];
  const converted: string[] = [];
  const reset: string[] = [];

  const currentBands = new Set(ap.radios.map((r) => r.band));
  const nextBands = new Set(next.supportedBands);

  const radiosRemoved = [...currentBands].filter((b) => !nextBands.has(b)) as Band[];
  const radiosAdded = [...nextBands].filter((b) => !currentBands.has(b)) as Band[];
  const bandsUnavailable = radiosRemoved;
  const bandsAvailable = radiosAdded;

  // For each preserved band, check whether the current radio settings are valid.
  for (const radio of ap.radios) {
    if (!nextBands.has(radio.band)) {
      reset.push(`${radio.band} GHz radio (band unsupported by ${next.model})`);
      continue;
    }
    const spec = next.radios.find((r) => r.band === radio.band);
    if (!spec) continue;
    if (radio.txPowerDbm > spec.maxTxPowerDbm) {
      converted.push(`${radio.band} GHz Tx power clamped to ${spec.maxTxPowerDbm} dBm`);
    } else {
      preserved.push(`${radio.band} GHz Tx power`);
    }
    if (!spec.supportedChannelWidthsMHz.includes(radio.channelWidthMHz)) {
      converted.push(`${radio.band} GHz channel width -> ${spec.supportedChannelWidthsMHz[0]} MHz`);
    }
    if (radio.spatialStreams > spec.maxSpatialStreams) {
      converted.push(`${radio.band} GHz spatial streams -> ${spec.maxSpatialStreams}`);
    }
    // Channel is validated against the regulatory allow-list elsewhere; keep if band matches.
    preserved.push(`${radio.band} GHz channel (revalidated)`);
  }

  const currentAntenna = currentProduct?.antenna.pattern ?? "omnidirectional";
  const antennaChange =
    currentAntenna !== next.antenna.pattern
      ? `Antenna changes from ${currentAntenna} to ${next.antenna.pattern}`
      : null;

  const regulatoryConflict =
    currentProduct && next.environment !== currentProduct.environment
      ? `Environment changes ${currentProduct.environment} -> ${next.environment}; verify regulatory limits.`
      : null;

  const managementChange =
    currentProduct && next.managementMode !== currentProduct.managementMode
      ? `Management mode changes ${currentProduct.managementMode} -> ${next.managementMode}`
      : null;

  const hasBlockingReview = reset.length > 0 || converted.length > 0 || radiosRemoved.length > 0;

  return {
    preserved,
    converted,
    reset,
    radiosAdded,
    radiosRemoved,
    bandsAvailable,
    bandsUnavailable,
    antennaChange,
    regulatoryConflict,
    managementChange,
    hasBlockingReview,
  };
}

/**
 * Apply the model change in place on a cloned AP, preserving compatible fields
 * and resetting unsupported ones. Returns the mutated AP. The caller wraps this
 * in a single undoable command.
 */
export function applyModelChange(ap: AccessPoint, next: ApProduct, nowIso: string): AccessPoint {
  const nextBands = new Set(next.supportedBands);

  // Keep radios for still-supported bands (converting settings); build fresh
  // radios for newly added bands.
  const keptRadios: Radio[] = [];
  for (const radio of ap.radios) {
    if (!nextBands.has(radio.band)) continue;
    const spec = next.radios.find((r) => r.band === radio.band);
    if (!spec) continue;
    keptRadios.push({
      ...radio,
      txPowerDbm: Math.min(radio.txPowerDbm, spec.maxTxPowerDbm),
      channelWidthMHz: spec.supportedChannelWidthsMHz.includes(radio.channelWidthMHz)
        ? radio.channelWidthMHz
        : (spec.supportedChannelWidthsMHz[0] ?? 20),
      spatialStreams: Math.min(radio.spatialStreams, spec.maxSpatialStreams),
      antennaGainDbi: next.antenna.gainDbi,
    });
  }
  for (const spec of next.radios) {
    if (keptRadios.some((r) => r.band === spec.band)) continue;
    keptRadios.push({
      band: spec.band,
      enabled: true,
      txPowerDbm: Math.min(spec.maxTxPowerDbm, 15),
      txPowerAuto: true,
      channel: 0,
      channelAuto: true,
      channelWidthMHz: spec.supportedChannelWidthsMHz.includes(40)
        ? 40
        : (spec.supportedChannelWidthsMHz[0] ?? 20),
      spatialStreams: Math.min(spec.maxSpatialStreams, 2),
      antennaGainDbi: next.antenna.gainDbi,
    });
  }
  // Deterministic order 2.4/5/6.
  const order: Record<Band, number> = { "2.4": 0, "5": 1, "6": 2 };
  keptRadios.sort((a, b) => order[a.band] - order[b.band]);

  const summary = computeModelChange(ap, undefined, next);

  ap.productId = next.id;
  ap.productRevisionId = next.productRevisionId ?? next.catalogDataVersion;
  ap.skuId = next.sku;
  ap.radios = keptRadios;
  ap.modelOverrideWarnings = [
    ...summary.converted.map((c) => `Converted: ${c}`),
    ...summary.reset.map((r) => `Reset: ${r}`),
  ];
  ap.catalogSnapshot = {
    productId: next.id,
    productRevisionId: next.productRevisionId ?? next.catalogDataVersion,
    model: next.model,
    sku: next.sku,
    catalogDataVersion: next.catalogDataVersion,
    capturedAt: nowIso,
  };
  // Preserve position, name, asset, switch, mounting height/orientation, notes.
  ap.updatedAt = nowIso;
  return ap;
}
