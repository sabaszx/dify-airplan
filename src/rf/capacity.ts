/**
 * Capacity estimator. All outputs are ESTIMATES based on declared assumptions.
 * See design.md §5.
 */
import type { Band } from "./pathloss";

export type ApplicationProfile =
  | "web-email"
  | "voice"
  | "hd-video"
  | "video-conference"
  | "high-density-classroom"
  | "custom";

/** Planning-default throughput per client (Mbps) by application profile. */
export const PROFILE_THROUGHPUT_MBPS: Record<ApplicationProfile, number> = {
  "web-email": 2,
  voice: 1,
  "hd-video": 8,
  "video-conference": 4,
  "high-density-classroom": 3,
  custom: 5,
};

export interface CapacityZoneInput {
  name: string;
  users: number;
  devicesPerUser: number;
  concurrencyPct: number; // 0..100
  profile: ApplicationProfile;
  throughputPerClientMbps?: number; // overrides profile default
  preferredBands: Band[];
}

export interface CapacityZoneResult {
  name: string;
  concurrentClients: number;
  aggregateDemandMbps: number;
  servingApCount: number;
  usableThroughputPerApMbps: number;
  apUtilization: number; // fraction (can exceed 1)
  airtimeWarning: boolean;
  overloaded: boolean;
  suggestedAdditionalAps: number;
}

export interface CapacityConfig {
  usableThroughputPerApMbps: number; // aggregate per-AP planning estimate
}

export const DEFAULT_CAPACITY_CONFIG: CapacityConfig = {
  usableThroughputPerApMbps: 300,
};

export function estimateZone(
  zone: CapacityZoneInput,
  servingApCount: number,
  cfg: CapacityConfig = DEFAULT_CAPACITY_CONFIG,
): CapacityZoneResult {
  const perClient = zone.throughputPerClientMbps ?? PROFILE_THROUGHPUT_MBPS[zone.profile];
  const concurrentClients = Math.round(
    zone.users * zone.devicesPerUser * (zone.concurrencyPct / 100),
  );
  const aggregateDemandMbps = concurrentClients * perClient;
  const aps = Math.max(0, servingApCount);
  const capacity = aps * cfg.usableThroughputPerApMbps;
  const apUtilization = capacity > 0 ? aggregateDemandMbps / capacity : Infinity;
  const requiredAps = Math.ceil(aggregateDemandMbps / cfg.usableThroughputPerApMbps);
  return {
    name: zone.name,
    concurrentClients,
    aggregateDemandMbps,
    servingApCount: aps,
    usableThroughputPerApMbps: cfg.usableThroughputPerApMbps,
    apUtilization: Number.isFinite(apUtilization)
      ? Math.round(apUtilization * 100) / 100
      : Infinity,
    airtimeWarning: apUtilization > 0.7,
    overloaded: apUtilization > 1.0,
    suggestedAdditionalAps: Math.max(0, requiredAps - aps),
  };
}
