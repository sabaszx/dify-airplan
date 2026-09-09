/**
 * Cisco AP catalog schema. Specifications are stored as DATA (JSON), not
 * hardcoded UI logic, so verified values can later be imported from official
 * Cisco data sheets. Every seeded record is flagged `verified: false`.
 * See requirements.md §4 and design.md §6.
 */
import { z } from "zod";

export const BandEnum = z.enum(["2.4", "5", "6"]);

export const RadioConfigSchema = z.object({
  band: BandEnum,
  maxSpatialStreams: z.number().int().positive(),
  supportedChannelWidthsMHz: z.array(z.number().int().positive()),
  minTxPowerDbm: z.number(),
  maxTxPowerDbm: z.number(),
});

export const AntennaSchema = z.object({
  integrated: z.boolean(),
  pattern: z.enum(["omnidirectional", "directional"]),
  gainDbi: z.number(),
  beamwidthDeg: z.number().optional(),
});

/** Datasheet/document provenance for a product spec or antenna pattern.
 *  See override §5. Store links + citations + extracted values only. */
export const PatternProvenanceSchema = z.object({
  manufacturer: z.string().optional(),
  documentTitle: z.string().optional(),
  documentType: z.enum(["datasheet", "deployment-guide", "antenna-reference", "other"]).optional(),
  sourceUrl: z.string().optional(),
  documentRevision: z.string().optional(),
  publicationDate: z.string().optional(),
  retrievedDate: z.string().nullable().optional(),
  page: z.number().optional(),
  figure: z.string().optional(),
  table: z.string().optional(),
  band: z.string().optional(),
  gainType: z.enum(["absolute", "relative"]).optional(),
  importedBy: z.string().optional(),
  verificationStatus: z
    .enum([
      "draft",
      "sample",
      "extracted-from-datasheet",
      "manually-reviewed",
      "manufacturer-verified",
      "deprecated",
    ])
    .default("sample"),
  importNotes: z.string().optional(),
});
export type PatternProvenance = z.infer<typeof PatternProvenanceSchema>;

/** A reference from a product to an antenna pattern, keyed by radio/antenna/
 *  mounting/orientation. See override §4. */
export const PatternRefSchema = z.object({
  band: BandEnum,
  antenna: z.enum(["integrated", "external"]).default("integrated"),
  mountingMode: z.enum(["ceiling", "wall", "pole", "outdoor", "any"]).default("any"),
  orientation: z.enum(["horizontal", "vertical", "any"]).default("any"),
  patternId: z.string(),
  patternRevisionId: z.string(),
  provenance: PatternProvenanceSchema.optional(),
});
export type PatternRef = z.infer<typeof PatternRefSchema>;

export const ApProductSchema = z.object({
  id: z.string(),
  manufacturer: z.string(),
  family: z.string(),
  model: z.string(),
  sku: z.string(),
  environment: z.enum(["indoor", "outdoor"]),
  wifiGeneration: z.enum(["Wi-Fi 6", "Wi-Fi 6E", "Wi-Fi 7"]),
  supportedBands: z.array(BandEnum),
  radios: z.array(RadioConfigSchema),
  antenna: AntennaSchema,
  ethernetInterfaces: z.array(z.string()),
  poeRequirement: z.string(),
  environmentalRating: z.string(),
  managementMode: z.enum(["Catalyst", "Meraki", "Dual-persona"]),
  controllerNotes: z.string(),
  regulatoryNotes: z.string(),
  datasheetUrl: z.string(),
  /** Optional model-specific antenna-pattern references. See override §4. */
  patternRefs: z.array(PatternRefSchema).optional(),
  // Data provenance & verification
  catalogDataVersion: z.string(),
  productRevisionId: z.string().optional(),
  lastVerified: z.string().nullable(),
  dataSource: z.string(),
  verified: z.boolean(),
});

export const CatalogSchema = z.object({
  catalogDataVersion: z.string(),
  disclaimer: z.string(),
  products: z.array(ApProductSchema),
});

export type ApProduct = z.infer<typeof ApProductSchema>;
export type RadioConfig = z.infer<typeof RadioConfigSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
