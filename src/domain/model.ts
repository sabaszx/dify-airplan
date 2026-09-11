/**
 * Domain model: types + Zod schemas for all entities. Coordinates are stored in
 * real-world METERS. See requirements.md §A and design.md §6.
 */
import { z } from "zod";

export const BandEnum = z.enum(["2.4", "5", "6"]);
export type Band = z.infer<typeof BandEnum>;

const AuditFields = {
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().optional(),
};

export const PointSchema = z.object({ x: z.number(), y: z.number() });

/** Per-technology/frequency attenuation model. Physical thickness and RF
 *  attenuation are related but NOT automatically equivalent. See override §1.5. */
export const AttenuationModelSchema = z.object({
  /** How loss is derived for this key:
   *  - "fixed": fixed loss per physical crossing (dB), independent of thickness
   *  - "per-thickness": lossPerMeter × in-material path length (dB)
   *  - "base-plus-thickness": baseDb + lossPerMeter × in-material path length */
  kind: z.enum(["fixed", "per-thickness", "base-plus-thickness"]).default("fixed"),
  fixedDb: z.number().default(0),
  baseDb: z.number().default(0),
  lossPerMeterDb: z.number().default(0),
});
export type AttenuationModel = z.infer<typeof AttenuationModelSchema>;

/** Attenuation keys cover Wi-Fi bands plus BLE and UWB. */
export const AttenuationKeyEnum = z.enum(["2.4", "5", "6", "ble", "uwb"]);
export type AttenuationKey = z.infer<typeof AttenuationKeyEnum>;

/** A single explicit attenuation sample (dB) for a technology + frequency.
 *  Attenuation is always entered in dB (override §3.1). */
export const AttenuationSampleSchema = z.object({
  technology: z.enum(["WIFI", "BLE", "UWB"]),
  frequencyMHz: z.number().positive(),
  lossDb: z.number(),
});
export type AttenuationSample = z.infer<typeof AttenuationSampleSchema>;

export const MaterialVerificationEnum = z.enum([
  "draft",
  "sample",
  "user-entered",
  "manually-reviewed",
  "verified",
  "deprecated",
]);
export type MaterialVerification = z.infer<typeof MaterialVerificationEnum>;

/** Wall/material with per-band attenuation (planning defaults, editable). All
 *  extended library fields are optional so legacy records remain valid. */
export const WallMaterialSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Legacy fixed per-band loss (dB), retained for backward compatibility. */
  attenuationDb: z.object({ "2.4": z.number(), "5": z.number(), "6": z.number() }),
  /** Optional per-technology attenuation MODELS (fixed / per-thickness / base+). */
  models: z.record(AttenuationKeyEnum, AttenuationModelSchema).optional(),
  isDefault: z.boolean().default(true),

  // --- Extended material-library fields (override §3). All optional. ---
  description: z.string().optional(),
  displayColor: z.string().optional(),
  displayPattern: z.enum(["solid", "hatch", "dashed", "dotted"]).optional(),
  defaultThicknessM: z.number().positive().optional(),
  minThicknessM: z.number().positive().optional(),
  maxThicknessM: z.number().positive().optional(),
  wallHeightDefaultM: z.number().positive().optional(),
  /** Explicit per-technology/frequency attenuation samples (dB). */
  attenuationSamples: z.array(AttenuationSampleSchema).optional(),
  source: z.string().optional(),
  verificationStatus: MaterialVerificationEnum.optional(),
  notes: z.string().optional(),
  version: z.number().int().nonnegative().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.boolean().optional(),
});
export type WallMaterial = z.infer<typeof WallMaterialSchema>;

/** An opening (door/window/archway) attached to a wall segment. Its position is
 *  parametric: `segmentIndex` selects the polyline segment and `t` (0..1) is the
 *  fractional distance along it, so the opening stays attached when the wall
 *  moves or resizes. RF models it as a replacement segment with its own
 *  attenuation. See design.md Addendum §E. */
export const OpeningSchema = z.object({
  id: z.string(),
  type: z.enum(["door", "window", "archway", "custom"]),
  segmentIndex: z.number().int().nonnegative(),
  t: z.number().min(0).max(1),
  widthM: z.number().positive().default(0.9),
  heightM: z.number().positive().default(2.1),
  bottomElevationM: z.number().default(0),
  open: z.boolean().default(false),
  attenuationDb: z.object({ "2.4": z.number(), "5": z.number(), "6": z.number() }).default({
    "2.4": 2,
    "5": 3,
    "6": 3,
  }),
});
export type Opening = z.infer<typeof OpeningSchema>;

export const WallSchema = z.object({
  id: z.string(),
  polyline: z.array(PointSchema).min(2),
  materialId: z.string(),
  thicknessM: z.number().positive().default(0.1),
  heightM: z.number().positive().default(2.7),
  bottomElevationM: z.number().default(0),
  openings: z.array(OpeningSchema).default([]),
});
export type Wall = z.infer<typeof WallSchema>;

export const RadioSchema = z.object({
  band: BandEnum,
  enabled: z.boolean(),
  txPowerDbm: z.number(),
  txPowerAuto: z.boolean().default(false),
  channel: z.number().int(), // 0 => Auto
  channelAuto: z.boolean().default(true),
  channelWidthMHz: z.number().int(),
  spatialStreams: z.number().int().positive(),
  antennaGainDbi: z.number(),
});
export type Radio = z.infer<typeof RadioSchema>;

/** Per-radio antenna assignment, recording the resolved pattern and provenance
 *  (incl. whether a fallback was used and why). See override §12. */
export const AntennaAssignmentSchema = z.object({
  radioId: z.string(), // band as radio identity in the MVP ("2.4"|"5"|"6")
  antennaId: z.string(),
  patternRevisionId: z.string().nullable(),
  frequencyMapping: z.string().optional(),
  portMapping: z.string().optional(),
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  mountingMode: z.enum(["ceiling", "wall", "pole", "outdoor"]).default("ceiling"),
  isFallback: z.boolean().default(true),
  fallbackReason: z.string().optional(),
  overrideReason: z.string().optional(),
});
export type AntennaAssignment = z.infer<typeof AntennaAssignmentSchema>;

/** Immutable snapshot of the catalog entry used at design time so a future
 *  catalog update never silently changes an existing project's simulation. */
export const CatalogSnapshotSchema = z.object({
  productId: z.string(),
  productRevisionId: z.string(),
  model: z.string(),
  sku: z.string(),
  catalogDataVersion: z.string(),
  capturedAt: z.string(),
});
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;

export const AccessPointSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productRevisionId: z.string().default("sample-0.1.0"),
  skuId: z.string().optional(),
  regulatoryProfileId: z.string().optional(),
  name: z.string(),
  position: PointSchema, // meters
  rotationDeg: z.number().default(0),
  orientationAzimuthDegrees: z.number().default(0),
  orientationDowntiltDegrees: z.number().default(0),
  mountingType: z.enum(["ceiling", "wall", "pole", "outdoor"]).default("ceiling"),
  mountingHeightM: z.number().default(3),
  antennaOverride: z
    .object({
      omnidirectional: z.boolean(),
      beamwidthDeg: z.number().optional(),
      gainDbi: z.number(),
    })
    .optional(),
  antennaAssignments: z.array(AntennaAssignmentSchema).default([]),
  radios: z.array(RadioSchema),
  modelOverrideWarnings: z.array(z.string()).default([]),
  catalogSnapshot: CatalogSnapshotSchema.optional(),
  assetTag: z.string().optional(),
  switchName: z.string().optional(),
  switchPort: z.string().optional(),
  ipAddress: z.string().optional(),
  notes: z.string().optional(),
  installStatus: z.enum(["planned", "installed", "verified"]).default("planned"),
  locked: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type AccessPoint = z.infer<typeof AccessPointSchema>;

export const CoverageRequirementSchema = z.object({
  id: z.string(),
  name: z.string(),
  polygon: z.array(PointSchema).min(3),
  zoneType: z.enum([
    "office",
    "meeting-room",
    "classroom",
    "auditorium",
    "warehouse",
    "lobby",
    "outdoor",
    "custom",
  ]),
  users: z.number().int().nonnegative(),
  devicesPerUser: z.number().nonnegative(),
  concurrencyPct: z.number().min(0).max(100),
  profile: z.enum([
    "web-email",
    "voice",
    "hd-video",
    "video-conference",
    "high-density-classroom",
    "custom",
  ]),
  throughputPerClientMbps: z.number().optional(),
  minRssiDbm: z.number().default(-67),
  minSnrDb: z.number().default(25),
  minSecondaryRssiDbm: z.number().optional(),
  preferredBands: z.array(BandEnum).default(["5"]),
});
export type CoverageRequirement = z.infer<typeof CoverageRequirementSchema>;

export const FloorPlanSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  /** Data URL or object-storage key. */
  imageSrc: z.string(),
  widthPx: z.number(),
  heightPx: z.number(),
  metersPerPixel: z.number().nullable(), // set by scale calibration
  locked: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
});
export type FloorPlan = z.infer<typeof FloorPlanSchema>;

export const FloorSchema = z.object({
  id: z.string(),
  name: z.string(),
  index: z.number().int(),
  ceilingHeightM: z.number().default(3),
  // Floor hierarchy / explicit ordering (override §4.3). Optional with defaults
  // so legacy projects migrate cleanly; ordering must not rely on string sort.
  floorNumber: z.number().int().default(1),
  sortOrder: z.number().default(0),
  baseElevationM: z.number().default(0),
  floorToFloorM: z.number().positive().default(3.5),
  archived: z.boolean().default(false),
  plan: FloorPlanSchema.nullable(),
  walls: z.array(WallSchema).default([]),
  accessPoints: z.array(AccessPointSchema).default([]),
  requirements: z.array(CoverageRequirementSchema).default([]),
});
export type Floor = z.infer<typeof FloorSchema>;

/** A building groups floors. Area/Site are optional wrappers (override §4). */
export const BuildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  siteId: z.string().optional(),
  areaId: z.string().optional(),
  floorIds: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
});
export type Building = z.infer<typeof BuildingSchema>;

/** Scenario-level visualization settings. Display-only; does NOT affect the
 *  simulation or coverage requirements. See override §2.5. Optional + defaulted
 *  so legacy scenarios remain valid. */
export const DisplayCutoffSchema = z.object({
  wifi: z.object({ "2.4": z.number(), "5": z.number(), "6": z.number() }),
  ble: z.number(),
  uwb: z.number(),
  hideBelow: z.boolean().default(true),
  belowColor: z.string().optional(),
});
export type DisplayCutoffPersisted = z.infer<typeof DisplayCutoffSchema>;

export const VisualizationSettingsSchema = z.object({
  displayCutoff: DisplayCutoffSchema.optional(),
});
export type VisualizationSettings = z.infer<typeof VisualizationSettingsSchema>;

export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  isBaseline: z.boolean().default(false),
  floors: z.array(FloorSchema),
  /** Optional building grouping (migrated in for legacy projects). */
  buildings: z.array(BuildingSchema).default([]),
  /** Optional display-only visualization settings (e.g. RSSI display cutoff). */
  visualization: VisualizationSettingsSchema.optional(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ThresholdsSchema = z.object({
  dataRssiDbm: z.number().default(-67),
  voiceRssiDbm: z.number().default(-65),
  highDensityRssiDbm: z.number().default(-62),
  minSnrDb: z.number().default(25),
  minSecondaryRssiDbm: z.number().default(-72),
  maxClientsPerAp: z.number().default(30),
  minThroughputMbps: z.number().default(25),
});
export type Thresholds = z.infer<typeof ThresholdsSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  ownerId: z.string(),
  name: z.string(),
  customer: z.string().default(""),
  location: z.string().default(""),
  regulatoryDomain: z.string().default("US"),
  allowDfs: z.boolean().default(false),
  unit: z.enum(["m", "ft"]).default("m"),
  locale: z.enum(["en", "th"]).default("en"),
  materials: z.array(WallMaterialSchema),
  thresholds: ThresholdsSchema,
  scenarios: z.array(ScenarioSchema).min(1),
  activeScenarioId: z.string(),
  archived: z.boolean().default(false),
  ...AuditFields,
});
export type Project = z.infer<typeof ProjectSchema>;

/** Starter materials — planning defaults, editable. See requirements.md §C. */
export const DEFAULT_MATERIALS: WallMaterial[] = [
  { id: "drywall", name: "Drywall", attenuationDb: { "2.4": 3, "5": 4, "6": 5 }, isDefault: true },
  { id: "glass", name: "Glass", attenuationDb: { "2.4": 3, "5": 6, "6": 8 }, isDefault: true },
  {
    id: "concrete",
    name: "Concrete",
    attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
    isDefault: true,
  },
  {
    id: "reinforced-concrete",
    name: "Reinforced Concrete",
    attenuationDb: { "2.4": 18, "5": 23, "6": 26 },
    isDefault: true,
  },
  { id: "brick", name: "Brick", attenuationDb: { "2.4": 8, "5": 10, "6": 12 }, isDefault: true },
  { id: "wood", name: "Wood", attenuationDb: { "2.4": 4, "5": 6, "6": 7 }, isDefault: true },
  { id: "metal", name: "Metal", attenuationDb: { "2.4": 26, "5": 32, "6": 35 }, isDefault: true },
  {
    id: "elevator",
    name: "Elevator Shaft",
    attenuationDb: { "2.4": 30, "5": 35, "6": 38 },
    isDefault: true,
  },
  {
    id: "custom",
    name: "Custom Material",
    attenuationDb: { "2.4": 5, "5": 7, "6": 9 },
    isDefault: false,
  },
];
