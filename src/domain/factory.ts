/**
 * Factory helpers to construct domain entities with sensible defaults.
 */
import {
  type Project,
  type Scenario,
  type Floor,
  type AccessPoint,
  type Radio,
  DEFAULT_MATERIALS,
  ThresholdsSchema,
} from "./model";
import { getProduct } from "@/catalog";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createFloor(index = 0, name?: string): Floor {
  return {
    id: uid("floor"),
    name: name ?? `Floor ${index + 1}`,
    index,
    ceilingHeightM: 3,
    plan: null,
    walls: [],
    accessPoints: [],
    requirements: [],
  };
}

export function createScenario(name: string, floors?: Floor[], isBaseline = false): Scenario {
  return {
    id: uid("scn"),
    name,
    isBaseline,
    floors: floors ?? [createFloor(0)],
  };
}

export function createProject(name: string, organizationId: string, ownerId: string): Project {
  const baseline = createScenario("Current design", undefined, true);
  return {
    id: uid("proj"),
    organizationId,
    ownerId,
    name,
    customer: "",
    location: "",
    regulatoryDomain: "US",
    allowDfs: false,
    unit: "m",
    locale: "en",
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    thresholds: ThresholdsSchema.parse({}),
    scenarios: [baseline],
    activeScenarioId: baseline.id,
    archived: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/** Build an AccessPoint instance from a catalog product at a meter position. */
export function createAccessPoint(
  productId: string,
  position: { x: number; y: number },
  name?: string,
): AccessPoint {
  const product = getProduct(productId);
  const radios: Radio[] = (product?.radios ?? []).map((r) => ({
    band: r.band,
    enabled: true,
    txPowerDbm: Math.min(r.maxTxPowerDbm, 15),
    txPowerAuto: true,
    channel: 0,
    channelAuto: true,
    channelWidthMHz: r.supportedChannelWidthsMHz.includes(40)
      ? 40
      : (r.supportedChannelWidthsMHz[0] ?? 20),
    spatialStreams: Math.min(r.maxSpatialStreams, 2),
    antennaGainDbi: product?.antenna.gainDbi ?? 4,
  }));
  const mountingType = product?.environment === "outdoor" ? "outdoor" : "ceiling";
  return {
    id: uid("ap"),
    productId,
    productRevisionId: product?.productRevisionId ?? product?.catalogDataVersion ?? "sample-0.1.0",
    name: name ?? product?.model ?? "Access Point",
    position,
    rotationDeg: 0,
    orientationAzimuthDegrees: 0,
    orientationDowntiltDegrees: 0,
    mountingType,
    mountingHeightM: 3,
    antennaAssignments: [],
    radios,
    modelOverrideWarnings: [],
    catalogSnapshot: product
      ? {
          productId: product.id,
          productRevisionId: product.productRevisionId ?? product.catalogDataVersion,
          model: product.model,
          sku: product.sku,
          catalogDataVersion: product.catalogDataVersion,
          capturedAt: nowIso(),
        }
      : undefined,
    installStatus: "planned",
    locked: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}
