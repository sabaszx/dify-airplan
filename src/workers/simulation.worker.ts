/**
 * Simulation Web Worker. Runs the framework-independent RF engine off the main
 * thread so the UI stays responsive. Supports progress + cancellation.
 * See design.md §7 and requirements.md §6.4.
 */
import {
  computeGrid,
  type GridSpec,
  type ApInput,
  type WallInput,
  type EngineConfig,
  type GridResult,
} from "@/rf/engine";
import type { Band } from "@/rf/pathloss";

export interface SimRequest {
  type: "simulate";
  jobId: string;
  spec: GridSpec;
  band: Band;
  aps: ApInput[];
  walls: WallInput[];
  config: EngineConfig;
}

export interface SimCancel {
  type: "cancel";
  jobId: string;
}

export type SimIncoming = SimRequest | SimCancel;

export interface SimProgress {
  type: "progress";
  jobId: string;
  fraction: number;
}

export interface SimDone {
  type: "done";
  jobId: string;
  result: GridResult;
}

export type SimOutgoing = SimProgress | SimDone;

let cancelledJobs = new Set<string>();

self.onmessage = (e: MessageEvent<SimIncoming>) => {
  const msg = e.data;
  if (msg.type === "cancel") {
    cancelledJobs.add(msg.jobId);
    return;
  }
  if (msg.type !== "simulate") return;

  const { jobId, spec, band, aps, walls, config } = msg;
  let lastReported = 0;
  const result = computeGrid(spec, band, aps, walls, config, (fraction) => {
    if (cancelledJobs.has(jobId)) throw new CancelError();
    // Throttle progress messages.
    if (fraction - lastReported >= 0.05 || fraction === 1) {
      lastReported = fraction;
      (self as unknown as Worker).postMessage({ type: "progress", jobId, fraction } as SimProgress);
    }
  });

  if (cancelledJobs.has(jobId)) {
    cancelledJobs.delete(jobId);
    return;
  }
  (self as unknown as Worker).postMessage({ type: "done", jobId, result } as SimDone);
};

class CancelError extends Error {}
