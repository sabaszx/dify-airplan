/**
 * Regulatory-domain channel/power rules as CONFIGURABLE DATA. These are planning
 * defaults only. Users MUST verify current local regulations (esp. 6 GHz and
 * power modes), including Thailand. Nothing here asserts legality. See design.md §4.
 */
import type { Band } from "@/rf/pathloss";

export interface ChannelDef {
  channel: number;
  centerMHz: number;
  dfs?: boolean;
}

export interface RegulatoryDomain {
  code: string;
  name: string;
  /** Planning-default note; not legal advice. */
  note: string;
  channels: Record<Band, ChannelDef[]>;
}

// 2.4 GHz: non-overlapping 1/6/11 emphasized but list all common 20 MHz channels.
const CH_24: ChannelDef[] = [1, 6, 11].map((c) => ({
  channel: c,
  centerMHz: 2412 + (c - 1) * 5,
}));

// 5 GHz representative 20 MHz channels (UNII-1/2/2e/3). DFS flagged.
const CH_5: ChannelDef[] = [
  { channel: 36, centerMHz: 5180 },
  { channel: 40, centerMHz: 5200 },
  { channel: 44, centerMHz: 5220 },
  { channel: 48, centerMHz: 5240 },
  { channel: 52, centerMHz: 5260, dfs: true },
  { channel: 56, centerMHz: 5280, dfs: true },
  { channel: 60, centerMHz: 5300, dfs: true },
  { channel: 64, centerMHz: 5320, dfs: true },
  { channel: 100, centerMHz: 5500, dfs: true },
  { channel: 104, centerMHz: 5520, dfs: true },
  { channel: 108, centerMHz: 5540, dfs: true },
  { channel: 112, centerMHz: 5560, dfs: true },
  { channel: 149, centerMHz: 5745 },
  { channel: 153, centerMHz: 5765 },
  { channel: 157, centerMHz: 5785 },
  { channel: 161, centerMHz: 5805 },
];

// 6 GHz representative 20 MHz channels (subset). Availability varies by country.
const CH_6: ChannelDef[] = [1, 5, 9, 13, 17, 21, 25, 29, 33, 37].map((c) => ({
  channel: c,
  centerMHz: 5955 + (c - 1) * 5,
}));

export const REGULATORY_DOMAINS: RegulatoryDomain[] = [
  {
    code: "US",
    name: "United States (FCC) — planning default",
    note: "Sample data. Verify current FCC rules, DFS, and 6 GHz AFC/LPI/VLP power modes.",
    channels: { "2.4": CH_24, "5": CH_5, "6": CH_6 },
  },
  {
    code: "EU",
    name: "European Union (ETSI) — planning default",
    note: "Sample data. Verify current ETSI rules; 6 GHz allocations differ from US.",
    channels: { "2.4": CH_24, "5": CH_5.filter((c) => c.channel <= 140), "6": CH_6.slice(0, 6) },
  },
  {
    code: "TH",
    name: "Thailand (NBTC) — planning default",
    note: "Sample data only. You MUST verify current NBTC regulations for 5/6 GHz channels and power. Do not assume any 6 GHz channel or power mode is permitted.",
    channels: { "2.4": CH_24, "5": CH_5, "6": CH_6.slice(0, 6) },
  },
];

export function getDomain(code: string): RegulatoryDomain {
  return REGULATORY_DOMAINS.find((d) => d.code === code) ?? REGULATORY_DOMAINS[0]!;
}

/** Allowed channels for a band, applying the DFS toggle. */
export function allowedChannels(
  domain: RegulatoryDomain,
  band: Band,
  allowDfs: boolean,
): ChannelDef[] {
  return domain.channels[band].filter((c) => allowDfs || !c.dfs);
}
