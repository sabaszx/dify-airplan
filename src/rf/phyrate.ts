/**
 * PHY-rate / throughput lookup tables. Configurable planning estimates, NOT
 * measurements. See design.md §3.9. Values approximate Wi-Fi 6 OFDMA behavior
 * and scale with channel width and spatial streams.
 */

export interface PhyRateRow {
  /** Minimum SINR (dB) to sustain this MCS tier. */
  minSinrDb: number;
  /** Base PHY rate (Mbps) for 20 MHz, 1 spatial stream, at this MCS. */
  baseMbps20MHz1ss: number;
  label: string;
}

/** Ordered from best to worst SINR. */
export const DEFAULT_PHY_TABLE: PhyRateRow[] = [
  { minSinrDb: 35, baseMbps20MHz1ss: 143, label: "MCS11 (4096-QAM)" },
  { minSinrDb: 31, baseMbps20MHz1ss: 129, label: "MCS10 (1024-QAM)" },
  { minSinrDb: 29, baseMbps20MHz1ss: 115, label: "MCS9 (256-QAM)" },
  { minSinrDb: 25, baseMbps20MHz1ss: 103, label: "MCS8 (256-QAM)" },
  { minSinrDb: 22, baseMbps20MHz1ss: 86, label: "MCS7 (64-QAM)" },
  { minSinrDb: 19, baseMbps20MHz1ss: 77, label: "MCS6 (64-QAM)" },
  { minSinrDb: 16, baseMbps20MHz1ss: 69, label: "MCS5 (64-QAM)" },
  { minSinrDb: 12, baseMbps20MHz1ss: 52, label: "MCS4 (16-QAM)" },
  { minSinrDb: 9, baseMbps20MHz1ss: 34, label: "MCS3 (16-QAM)" },
  { minSinrDb: 6, baseMbps20MHz1ss: 26, label: "MCS2 (QPSK)" },
  { minSinrDb: 3, baseMbps20MHz1ss: 17, label: "MCS1 (QPSK)" },
  { minSinrDb: 1, baseMbps20MHz1ss: 8, label: "MCS0 (BPSK)" },
  { minSinrDb: -Infinity, baseMbps20MHz1ss: 0, label: "No link" },
];

/** Channel-width scaling relative to 20 MHz (approx tone-count ratios). */
export function widthScale(widthMHz: number): number {
  switch (widthMHz) {
    case 20:
      return 1;
    case 40:
      return 2.08;
    case 80:
      return 4.34;
    case 160:
      return 8.68;
    case 320:
      return 17.36; // Wi-Fi 7 320 MHz
    default:
      return widthMHz / 20;
  }
}

export interface PhyEstimate {
  mcsLabel: string;
  phyRateMbps: number;
  usableThroughputMbps: number;
}

/**
 * Estimate PHY rate and usable throughput from SINR.
 * @param efficiencyFactor MAC/airtime efficiency (default 0.5). Configurable.
 */
export function estimatePhy(
  sinrDb: number,
  widthMHz: number,
  spatialStreams: number,
  efficiencyFactor = 0.5,
  table: PhyRateRow[] = DEFAULT_PHY_TABLE,
): PhyEstimate {
  const row = table.find((r) => sinrDb >= r.minSinrDb) ?? table[table.length - 1]!;
  const phyRateMbps = row.baseMbps20MHz1ss * widthScale(widthMHz) * Math.max(1, spatialStreams);
  return {
    mcsLabel: row.label,
    phyRateMbps: Math.round(phyRateMbps),
    usableThroughputMbps: Math.round(phyRateMbps * efficiencyFactor),
  };
}
