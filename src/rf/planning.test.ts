import { describe, it, expect } from "vitest";
import { planChannels } from "./channel";
import { estimateZone } from "./capacity";
import { getDomain, allowedChannels } from "@/regulatory/domains";
import type { ApInput } from "./engine";

function ap(id: string, x: number, y: number): ApInput {
  return {
    id,
    position: { x, y },
    mountingHeightM: 3,
    radios: [
      {
        band: "5",
        enabled: true,
        txPowerDbm: 15,
        channel: 0,
        channelWidthMHz: 40,
        spatialStreams: 2,
        antenna: { gainDbi: 4, omnidirectional: true },
      },
    ],
  };
}

describe("channel planner (mandatory test)", () => {
  const domain = getDomain("US");
  const allowed = allowedChannels(domain, "5", false); // DFS disabled

  it("never assigns unsupported channels", () => {
    const aps = [ap("a", 0, 0), ap("b", 5, 0), ap("c", 10, 0)];
    const assignments = planChannels("5", aps, allowed);
    const allowedSet = new Set(allowed.map((c) => c.channel));
    for (const asg of assignments) {
      expect(allowedSet.has(asg.channel)).toBe(true);
    }
  });

  it("does not assign DFS channels when DFS is disabled", () => {
    const aps = [ap("a", 0, 0), ap("b", 3, 0)];
    const assignments = planChannels("5", aps, allowed);
    const dfsChannels = new Set(domain.channels["5"].filter((c) => c.dfs).map((c) => c.channel));
    for (const asg of assignments) {
      expect(dfsChannels.has(asg.channel)).toBe(false);
    }
  });

  it("gives close neighbors different channels when possible", () => {
    const aps = [ap("a", 0, 0), ap("b", 2, 0)]; // very close => audible
    const assignments = planChannels("5", aps, allowed);
    expect(assignments[0]!.channel).not.toBe(assignments[1]!.channel);
  });

  it("is deterministic", () => {
    const aps = [ap("a", 0, 0), ap("b", 6, 0), ap("c", 3, 4)];
    expect(planChannels("5", aps, allowed)).toEqual(planChannels("5", aps, allowed));
  });
});

describe("capacity estimator", () => {
  it("computes concurrent clients and utilization", () => {
    const r = estimateZone(
      {
        name: "Classroom",
        users: 40,
        devicesPerUser: 1.5,
        concurrencyPct: 100,
        profile: "high-density-classroom",
        preferredBands: ["5"],
      },
      1,
      { usableThroughputPerApMbps: 300 },
    );
    expect(r.concurrentClients).toBe(60);
    expect(r.aggregateDemandMbps).toBe(180); // 60 * 3 Mbps
    expect(r.apUtilization).toBeCloseTo(0.6, 2);
    expect(r.overloaded).toBe(false);
  });

  it("flags overload and suggests more APs", () => {
    const r = estimateZone(
      {
        name: "Auditorium",
        users: 500,
        devicesPerUser: 1,
        concurrencyPct: 100,
        profile: "hd-video",
        preferredBands: ["5"],
      },
      1,
      { usableThroughputPerApMbps: 300 },
    );
    expect(r.overloaded).toBe(true);
    expect(r.suggestedAdditionalAps).toBeGreaterThan(0);
  });
});
