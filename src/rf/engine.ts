/**
 * RF prediction engine. Framework-independent, deterministic, no DOM.
 * Computes per-grid-point RSSI/SNR/interference/throughput/capacity.
 * See design.md §3.
 */
import { type Point, type Segment, distance, azimuthDeg, segmentsIntersect } from "./geometry";
import { type Band, logDistancePathLoss, resolveFreqMHz, PATH_LOSS_EXPONENT } from "./pathloss";
import { type AntennaConfig, effectiveGain } from "./antenna";
import { estimatePhy } from "./phyrate";
import { dbmToMw, mwToDbm } from "@/lib/units";
import type { AntennaPattern } from "@/antenna/schema";
import { gainFromPattern, fallbackGain } from "@/antenna/gain";
import type { WallMaterial, AttenuationKey } from "@/domain/model";
import { resolveAttenuationDb, isThicknessDependent } from "./attenuation";
import { segmentRect, inMaterialLength } from "@/geometry/thick-wall";

export interface WallPieceInput {
  a: Point;
  b: Point;
  attenuationDb: Record<Band, number>;
  thicknessM: number;
}

export interface WallInput {
  polyline: Point[]; // meters
  /** Per-band attenuation in dB (planning defaults, editable). */
  attenuationDb: Record<Band, number>;
  thicknessM: number;
  /** Optional pre-split pieces (e.g. from openings). When present these are used
   *  instead of the whole polyline so an opening span applies its own (lower)
   *  attenuation. See design.md Addendum §E. */
  pieces?: WallPieceInput[];
  /** Optional full material + alignment for thickness-aware attenuation models.
   *  When present, the engine uses the in-material path length (fixed materials
   *  are still counted once per crossing). See override §1.5. */
  material?: WallMaterial;
  alignment?: "center" | "left" | "right";
}

export interface RadioInput {
  band: Band;
  enabled: boolean;
  txPowerDbm: number;
  channel: number; // 0 => auto/unassigned
  channelCenterMHz?: number;
  channelWidthMHz: number;
  spatialStreams: number;
  antenna: AntennaConfig;
  /** Optional imported/validated antenna pattern. When present, its directional
   *  gain (with circular interpolation) is used instead of the cosine model.
   *  A directional antenna is never silently treated as omnidirectional. */
  pattern?: AntennaPattern;
}

export interface ApInput {
  id: string;
  position: Point; // meters
  mountingHeightM: number;
  radios: RadioInput[];
}

export interface EngineConfig {
  environment: keyof typeof PATH_LOSS_EXPONENT;
  noiseFloorDbm: Record<Band, number>;
  clientHeightM: number;
  clientGainDbi: number;
  adjacentRejectionDb: number;
  audibleThresholdDbm: number;
  requiredThroughputPerClientMbps: number;
  efficiencyFactor: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  environment: "office",
  noiseFloorDbm: { "2.4": -95, "5": -92, "6": -92 },
  clientHeightM: 1.0,
  clientGainDbi: 0,
  adjacentRejectionDb: 20,
  audibleThresholdDbm: -85,
  requiredThroughputPerClientMbps: 5,
  efficiencyFactor: 0.5,
};

export interface PointResult {
  rssiDbm: number; // best serving
  bestApId: string | null;
  secondaryRssiDbm: number;
  secondaryApId: string | null;
  noiseFloorDbm: number;
  snrDb: number;
  sinrDb: number;
  coChannelDbm: number;
  adjChannelDbm: number;
  audibleApCount: number;
  phyRateMbps: number;
  usableThroughputMbps: number;
  mcsLabel: string;
  estimatedClientCapacity: number;
}

function wallLossAlongPath(apPos: Point, target: Point, band: Band, walls: WallInput[]): number {
  return wallLossForKey(apPos, target, band as AttenuationKey, walls);
}

/**
 * Total wall attenuation (dB) along a path, keyed by technology/band.
 * - Openings: pre-split pieces apply their own attenuation.
 * - Material with an explicit attenuation model: fixed loss is counted ONCE per
 *   physical crossing; thickness-dependent loss uses the in-material path length
 *   (longer for oblique traversal). See override §1.5.
 * - Otherwise: legacy per-band fixed loss scaled by a thickness factor.
 */
function wallLossForKey(
  apPos: Point,
  target: Point,
  key: AttenuationKey,
  walls: WallInput[],
): number {
  const path: Segment = { a: apPos, b: target };
  let loss = 0;
  const refThickness = 0.1; // m, legacy scaling reference (design.md §3.4)
  const legacyBand: Band = key === "ble" ? "2.4" : key === "uwb" ? "6" : (key as Band);

  for (const wall of walls) {
    if (wall.pieces && wall.pieces.length > 0) {
      for (const piece of wall.pieces) {
        if (segmentsIntersect(path, { a: piece.a, b: piece.b })) {
          const thicknessFactor = clamp(piece.thicknessM / refThickness, 0.5, 3);
          loss += piece.attenuationDb[legacyBand] * thicknessFactor;
        }
      }
      continue;
    }

    // Thickness-aware material model.
    if (wall.material) {
      const align = wall.alignment ?? "center";
      const thicknessDep = isThicknessDependent(wall.material, key);
      for (let i = 0; i < wall.polyline.length - 1; i++) {
        const a = wall.polyline[i]!;
        const b = wall.polyline[i + 1]!;
        if (thicknessDep) {
          // Per-thickness: use the actual in-material path length.
          const rect = segmentRect(a, b, wall.thicknessM, align);
          const len = inMaterialLength(apPos, target, rect);
          if (len > 0) loss += resolveAttenuationDb(wall.material, key, len);
        } else if (segmentsIntersect(path, { a, b })) {
          // Fixed: counted once per crossing, thickness ignored.
          loss += resolveAttenuationDb(wall.material, key, wall.thicknessM);
        }
      }
      continue;
    }

    // Legacy fixed per-band loss with a thickness factor.
    for (let i = 0; i < wall.polyline.length - 1; i++) {
      const seg: Segment = { a: wall.polyline[i]!, b: wall.polyline[i + 1]! };
      if (segmentsIntersect(path, seg)) {
        const thicknessFactor = clamp(wall.thicknessM / refThickness, 0.5, 3);
        loss += wall.attenuationDb[legacyBand] * thicknessFactor;
      }
    }
  }
  return loss;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Resolve the transmit-antenna gain (dBi) toward the target. Priority:
 * 1. Imported/validated pattern → gainFromPattern (circular interpolation,
 *    orientation + downtilt applied, az/el cuts combined per design.md §D.1).
 * 2. No pattern but directional → fallbackGain (labeled cosine, never omni).
 * 3. Omnidirectional → uniform peak gain.
 */
function resolveGain(
  ap: ApInput,
  radio: RadioInput,
  worldAzimuthDeg: number,
  horizontalDist: number,
  heightDiff: number,
  freqMHz: number,
): number {
  // Elevation angle from AP toward the (lower) client point.
  const elevationDeg = -(Math.atan2(heightDiff, Math.max(horizontalDist, 1e-6)) * 180) / Math.PI;

  if (radio.pattern) {
    const localAz = worldAzimuthDeg - (radio.antenna.boresightDeg ?? 0);
    const localEl = elevationDeg - (radio.pattern.antenna.downtiltDeg ?? 0);
    return gainFromPattern(radio.pattern, {
      azimuthDeg: localAz,
      elevationDeg: localEl,
      frequencyMHz: freqMHz,
    }).gainDbi;
  }

  if (!radio.antenna.omnidirectional) {
    const localAz = worldAzimuthDeg - (radio.antenna.boresightDeg ?? 0);
    return fallbackGain(
      radio.antenna.gainDbi,
      radio.antenna.beamwidthDeg ?? 65,
      radio.antenna.frontToBackDb ?? 25,
      { azimuthDeg: localAz, elevationDeg, frequencyMHz: freqMHz },
    ).gainDbi;
  }

  return effectiveGain(radio.antenna, worldAzimuthDeg);
}

/** Signal (dBm) at a target point from one AP radio. */
export function signalFromRadio(
  ap: ApInput,
  radio: RadioInput,
  target: Point,
  walls: WallInput[],
  cfg: EngineConfig,
): number {
  const dh = distance(ap.position, target);
  const dz = Math.abs(ap.mountingHeightM - cfg.clientHeightM);
  const d = Math.hypot(dh, dz); // slant distance, design.md §3.6
  const freqMHz = resolveFreqMHz(radio.band, radio.channelCenterMHz);
  const pl = logDistancePathLoss(d, freqMHz, PATH_LOSS_EXPONENT[cfg.environment]);
  const az = azimuthDeg(ap.position, target);
  const gt = resolveGain(ap, radio, az, dh, dz, freqMHz);
  const wallLoss = wallLossAlongPath(ap.position, target, radio.band, walls);
  return radio.txPowerDbm + gt + cfg.clientGainDbi - pl - wallLoss;
}

/**
 * Compute the full per-point result for a given band. Only radios on `band` that
 * are enabled participate (disabled radios never appear — mandatory test).
 */
export function computePoint(
  target: Point,
  band: Band,
  aps: ApInput[],
  walls: WallInput[],
  cfg: EngineConfig = DEFAULT_ENGINE_CONFIG,
): PointResult {
  const noise = cfg.noiseFloorDbm[band];

  interface Contribution {
    apId: string;
    rssi: number;
    channel: number;
    widthMHz: number;
    ss: number;
  }
  const contributions: Contribution[] = [];

  for (const ap of aps) {
    for (const radio of ap.radios) {
      if (radio.band !== band || !radio.enabled) continue;
      const rssi = signalFromRadio(ap, radio, target, walls, cfg);
      contributions.push({
        apId: ap.id,
        rssi,
        channel: radio.channel,
        widthMHz: radio.channelWidthMHz,
        ss: radio.spatialStreams,
      });
    }
  }

  // Deterministic ordering: strongest first, then by apId for stable ties.
  contributions.sort((a, b) => b.rssi - a.rssi || (a.apId < b.apId ? -1 : 1));

  if (contributions.length === 0) {
    return {
      rssiDbm: -Infinity,
      bestApId: null,
      secondaryRssiDbm: -Infinity,
      secondaryApId: null,
      noiseFloorDbm: noise,
      snrDb: -Infinity,
      sinrDb: -Infinity,
      coChannelDbm: -Infinity,
      adjChannelDbm: -Infinity,
      audibleApCount: 0,
      phyRateMbps: 0,
      usableThroughputMbps: 0,
      mcsLabel: "No link",
      estimatedClientCapacity: 0,
    };
  }

  const best = contributions[0]!;
  const secondary = contributions[1];

  // Interference: sum linear powers of other APs by channel relationship.
  let coMw = 0;
  let adjMw = 0;
  for (let i = 1; i < contributions.length; i++) {
    const c = contributions[i]!;
    if (best.channel !== 0 && c.channel === best.channel) {
      coMw += dbmToMw(c.rssi);
    } else if (best.channel !== 0 && Math.abs(c.channel - best.channel) <= best.widthMHz / 20) {
      adjMw += dbmToMw(c.rssi) / dbmToMw(cfg.adjacentRejectionDb);
    }
  }
  const coChannelDbm = coMw > 0 ? mwToDbm(coMw) : -Infinity;
  const adjChannelDbm = adjMw > 0 ? mwToDbm(adjMw) : -Infinity;

  const noiseMw = dbmToMw(noise);
  const sinrDb = best.rssi - mwToDbm(noiseMw + coMw + adjMw);
  const snrDb = best.rssi - noise;

  const audibleApCount = contributions.filter((c) => c.rssi >= cfg.audibleThresholdDbm).length;

  const phy = estimatePhy(sinrDb, best.widthMHz, best.ss, cfg.efficiencyFactor);
  const estimatedClientCapacity =
    cfg.requiredThroughputPerClientMbps > 0
      ? Math.floor(phy.usableThroughputMbps / cfg.requiredThroughputPerClientMbps)
      : 0;

  return {
    rssiDbm: round1(best.rssi),
    bestApId: best.apId,
    secondaryRssiDbm: secondary ? round1(secondary.rssi) : -Infinity,
    secondaryApId: secondary ? secondary.apId : null,
    noiseFloorDbm: noise,
    snrDb: round1(snrDb),
    sinrDb: round1(sinrDb),
    coChannelDbm: coChannelDbm === -Infinity ? -Infinity : round1(coChannelDbm),
    adjChannelDbm: adjChannelDbm === -Infinity ? -Infinity : round1(adjChannelDbm),
    audibleApCount,
    phyRateMbps: phy.phyRateMbps,
    usableThroughputMbps: phy.usableThroughputMbps,
    mcsLabel: phy.mcsLabel,
    estimatedClientCapacity,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface GridSpec {
  originM: Point; // top-left in meters
  widthM: number;
  heightM: number;
  resolutionM: number; // Draft 1.0, Standard 0.5, High 0.25
}

export interface GridResult {
  spec: GridSpec;
  band: Band;
  cols: number;
  rows: number;
  /** Flat row-major array of point results. */
  cells: PointResult[];
}

/** Compute a full grid. Deterministic for identical inputs (mandatory test). */
export function computeGrid(
  spec: GridSpec,
  band: Band,
  aps: ApInput[],
  walls: WallInput[],
  cfg: EngineConfig = DEFAULT_ENGINE_CONFIG,
  onProgress?: (fraction: number) => void,
): GridResult {
  const cols = Math.max(1, Math.ceil(spec.widthM / spec.resolutionM));
  const rows = Math.max(1, Math.ceil(spec.heightM / spec.resolutionM));
  const cells: PointResult[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const target: Point = {
        x: spec.originM.x + c * spec.resolutionM,
        y: spec.originM.y + r * spec.resolutionM,
      };
      cells[r * cols + c] = computePoint(target, band, aps, walls, cfg);
    }
    if (onProgress) onProgress((r + 1) / rows);
  }
  return { spec, band, cols, rows, cells };
}
