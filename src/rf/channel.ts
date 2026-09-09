/**
 * Channel planner. Greedy conflict-minimizing assignment respecting the
 * regulatory allow-list. Never assigns unsupported channels. See design.md §4.
 */
import type { Band } from "./pathloss";
import type { ChannelDef } from "@/regulatory/domains";
import { type ApInput, signalFromRadio, DEFAULT_ENGINE_CONFIG } from "./engine";

export interface ChannelAssignment {
  apId: string;
  channel: number;
  centerMHz: number;
  reason: string;
}

const W_CO = 100; // co-channel penalty weight
const W_ADJ = 25; // adjacent-channel penalty weight

/**
 * Assign channels for one band. `allowed` is the regulatory allow-list.
 * Returns one assignment per AP that has an enabled radio on the band.
 */
export function planChannels(
  band: Band,
  aps: ApInput[],
  allowed: ChannelDef[],
): ChannelAssignment[] {
  if (allowed.length === 0) return [];

  // Precompute pairwise "audibility" via mutual RSSI at each other's location.
  const participating = aps.filter((ap) => ap.radios.some((r) => r.band === band && r.enabled));

  const neighborWeight = new Map<string, Map<string, number>>();
  for (const a of participating) {
    const m = new Map<string, number>();
    const radioA = a.radios.find((r) => r.band === band && r.enabled)!;
    for (const b of participating) {
      if (a.id === b.id) continue;
      const rssi = signalFromRadio(a, radioA, b.position, [], DEFAULT_ENGINE_CONFIG);
      // Weight rises as neighbors get louder; ignore very weak neighbors.
      const w = rssi > -85 ? rssi + 100 : 0;
      m.set(b.id, w);
    }
    neighborWeight.set(a.id, m);
  }

  // Order by descending neighbor degree for a stable, sensible greedy pass.
  const ordered = [...participating].sort((x, y) => {
    const dx = sumWeights(neighborWeight.get(x.id));
    const dy = sumWeights(neighborWeight.get(y.id));
    return dy - dx || (x.id < y.id ? -1 : 1);
  });

  const assigned = new Map<string, number>();
  const results: ChannelAssignment[] = [];

  for (const ap of ordered) {
    let bestChannel = allowed[0]!;
    let bestCost = Infinity;
    for (const cand of allowed) {
      let cost = 0;
      const weights = neighborWeight.get(ap.id)!;
      for (const [otherId, w] of weights) {
        const otherCh = assigned.get(otherId);
        if (otherCh === undefined || w <= 0) continue;
        if (otherCh === cand.channel) cost += W_CO * (w / 100);
        else if (Math.abs(otherCh - cand.channel) <= 4) cost += W_ADJ * (w / 100);
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestChannel = cand;
      }
    }
    assigned.set(ap.id, bestChannel.channel);
    results.push({
      apId: ap.id,
      channel: bestChannel.channel,
      centerMHz: bestChannel.centerMHz,
      reason:
        bestCost === 0
          ? "No audible neighbor conflict on this channel."
          : `Lowest interference cost (${bestCost.toFixed(1)}) among allowed channels; minimizes co/adjacent-channel overlap with neighbors.`,
    });
  }

  // Deterministic output order by apId.
  results.sort((a, b) => (a.apId < b.apId ? -1 : 1));
  return results;
}

function sumWeights(m?: Map<string, number>): number {
  if (!m) return 0;
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}
