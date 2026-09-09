/**
 * Extensible antenna-pattern data model. Supports adding future Cisco and
 * third-party APs and antennas WITHOUT changing the RF engine or UI source.
 * Provided as a Zod schema; a matching JSON Schema is exported for external
 * tooling. See requirements.md §6 and design.md Addendum §D.
 */
import { z } from "zod";

export const VerificationStatus = z.enum([
  "draft",
  "sample",
  "unverified",
  "verified",
  "deprecated",
  "archived",
]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const AngleSampleSchema = z.object({
  angleDeg: z.number(),
  gainDbi: z.number(),
});
export type AngleSample = z.infer<typeof AngleSampleSchema>;

export const FrequencyPatternSchema = z.object({
  frequencyMHz: z.number().positive(),
  peakGainDbi: z.number(),
  /** Azimuth cut (horizontal), angles 0..360 (or -180..180). */
  azimuth: z.array(AngleSampleSchema).min(2),
  /** Elevation cut (vertical), angles typically -90..90. */
  elevation: z.array(AngleSampleSchema).min(2),
  beamwidthDeg: z.number().optional(),
  frontToBackDb: z.number().optional(),
});
export type FrequencyPattern = z.infer<typeof FrequencyPatternSchema>;

export const AntennaSchema = z.object({
  name: z.string(),
  type: z.enum(["omnidirectional", "sector", "patch", "directional", "custom"]),
  internal: z.boolean().default(true),
  polarization: z.enum(["single", "dual", "vertical", "horizontal", "circular"]).default("dual"),
  coordinateSystem: z.enum(["spherical"]).default("spherical"),
  orientation: z
    .object({ forwardAxis: z.string().default("+Y"), upAxis: z.string().default("+Z") })
    .default({ forwardAxis: "+Y", upAxis: "+Z" }),
  downtiltDeg: z.number().default(0),
  connector: z.string().optional(),
});
export type Antenna = z.infer<typeof AntennaSchema>;

export const PatternSourceSchema = z.object({
  type: z.enum(["manufacturer-datasheet", "measurement", "sample", "user-entered", "import"]),
  url: z.string().optional(),
  document: z.string().optional(),
  lastVerified: z.string().nullable().default(null),
});

export const AntennaPatternSchema = z.object({
  schemaVersion: z.literal("1.0"),
  id: z.string(),
  /** Monotonic revision; derived transforms bump this. */
  revision: z.number().int().nonnegative().default(0),
  manufacturer: z.string(),
  model: z.string(),
  antenna: AntennaSchema,
  patterns: z.array(FrequencyPatternSchema).min(1),
  source: PatternSourceSchema,
  verificationStatus: VerificationStatus.default("sample"),
  notes: z.string().optional(),
  /** Preserved raw import payload for provenance (never mutated by transforms). */
  originalImport: z.unknown().optional(),
});
export type AntennaPattern = z.infer<typeof AntennaPatternSchema>;

/** Minimal JSON Schema mirror for external tooling / documentation. */
export const ANTENNA_PATTERN_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "AntennaPattern",
  type: "object",
  required: ["schemaVersion", "manufacturer", "model", "antenna", "patterns", "source"],
  properties: {
    schemaVersion: { const: "1.0" },
    manufacturer: { type: "string" },
    model: { type: "string" },
    antenna: {
      type: "object",
      required: ["name", "type"],
      properties: {
        name: { type: "string" },
        type: { enum: ["omnidirectional", "sector", "patch", "directional", "custom"] },
        polarization: { type: "string" },
        coordinateSystem: { const: "spherical" },
      },
    },
    patterns: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["frequencyMHz", "peakGainDbi", "azimuth", "elevation"],
        properties: {
          frequencyMHz: { type: "number", exclusiveMinimum: 0 },
          peakGainDbi: { type: "number" },
          azimuth: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              required: ["angleDeg", "gainDbi"],
              properties: { angleDeg: { type: "number" }, gainDbi: { type: "number" } },
            },
          },
          elevation: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              required: ["angleDeg", "gainDbi"],
              properties: { angleDeg: { type: "number" }, gainDbi: { type: "number" } },
            },
          },
        },
      },
    },
    source: { type: "object" },
    verificationStatus: {
      enum: ["draft", "sample", "unverified", "verified", "deprecated", "archived"],
    },
  },
} as const;
