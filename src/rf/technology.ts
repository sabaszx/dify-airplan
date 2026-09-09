/**
 * Technology-independent radio model. The RF engine uses pluggable technology
 * profiles instead of Wi-Fi-specific assumptions spread across the codebase.
 * See override §2. Original code, deterministic, no DOM.
 */
import type { AttenuationKey } from "@/domain/model";

export type Technology = "WIFI" | "BLE" | "UWB";

export interface ChannelDefinition {
  id: string;
  label: string;
  centerMHz: number;
  bandwidthMHz: number;
}

/** Receiver assumptions used to evaluate coverage for a technology. */
export interface ReceiverProfile {
  /** Client/receiver antenna gain (dBi). */
  gainDbi: number;
  /** Noise floor (dBm) for SNR-style calculations. */
  noiseFloorDbm: number;
  /** Sensitivity / minimum usable received power (dBm) for basic detectability. */
  sensitivityDbm: number;
}

/**
 * A technology profile ties together the frequency/channel space, default path-
 * loss exponent, wall-attenuation key, and receiver assumptions. It is the seam
 * that lets BLE/UWB reuse the same engine as Wi-Fi.
 */
export interface RadioTechnologyProfile {
  technology: Technology;
  label: string;
  /** Attenuation key used to look up material loss. */
  attenuationKey: AttenuationKey;
  /** Representative center frequency (MHz) when no channel is specified. */
  defaultCenterMHz: number;
  /** Default path-loss exponent (indoor). */
  pathLossExponent: number;
  channels: ChannelDefinition[];
  receiver: ReceiverProfile;
  /** Human-readable notes/limitations shown in the inspector and report. */
  notes: string;
}

/** BLE: 40 channels of 2 MHz across 2.4 GHz; advertising ch 37/38/39. */
const BLE_CHANNELS: ChannelDefinition[] = [37, 38, 39].map((c) => ({
  id: `adv-${c}`,
  label: `Adv ${c}`,
  centerMHz: c === 37 ? 2402 : c === 38 ? 2426 : 2480,
  bandwidthMHz: 2,
}));

/** UWB: representative HRP channels (center freq, ~500 MHz bandwidth). Sample. */
const UWB_CHANNELS: ChannelDefinition[] = [
  { id: "ch5", label: "Channel 5", centerMHz: 6489.6, bandwidthMHz: 499.2 },
  { id: "ch9", label: "Channel 9", centerMHz: 7987.2, bandwidthMHz: 499.2 },
];

export const TECHNOLOGY_PROFILES: Record<Technology, RadioTechnologyProfile> = {
  WIFI: {
    technology: "WIFI",
    label: "Wi-Fi",
    attenuationKey: "5",
    defaultCenterMHz: 5500,
    pathLossExponent: 3.0,
    channels: [],
    receiver: { gainDbi: 0, noiseFloorDbm: -92, sensitivityDbm: -82 },
    notes: "Wi-Fi channels are defined per regulatory domain (see regulatory module).",
  },
  BLE: {
    technology: "BLE",
    label: "BLE",
    attenuationKey: "ble",
    defaultCenterMHz: 2440,
    pathLossExponent: 2.7,
    channels: BLE_CHANNELS,
    receiver: { gainDbi: 0, noiseFloorDbm: -95, sensitivityDbm: -95 },
    notes: "Predicted BLE RSSI is not guaranteed positioning accuracy. Validate on site.",
  },
  UWB: {
    technology: "UWB",
    label: "UWB",
    attenuationKey: "uwb",
    defaultCenterMHz: 6489.6,
    pathLossExponent: 2.2,
    channels: UWB_CHANNELS,
    receiver: { gainDbi: 0, noiseFloorDbm: -100, sensitivityDbm: -90 },
    notes:
      "UWB ranging accuracy depends on multipath, NLOS, calibration, antenna delay, clock sync, anchor geometry, and body obstruction. Signal-strength prediction does not imply centimeter accuracy; a site validation is required.",
  },
};

export function getTechnologyProfile(tech: Technology): RadioTechnologyProfile {
  return TECHNOLOGY_PROFILES[tech];
}

/** Resolve the working center frequency for a technology + optional channel id. */
export function resolveTechFreqMHz(tech: Technology, channelId?: string): number {
  const profile = TECHNOLOGY_PROFILES[tech];
  if (channelId) {
    const ch = profile.channels.find((c) => c.id === channelId);
    if (ch) return ch.centerMHz;
  }
  return profile.defaultCenterMHz;
}

/**
 * A PropagationModel computes received power for a technology. The default
 * log-distance implementation is shared; a technology can supply its own.
 */
export interface PropagationModel {
  technology: Technology;
  /** Path loss (dB) for a distance (m) at a frequency (MHz). */
  pathLossDb(distanceMeters: number, freqMHz: number, exponent: number): number;
}
