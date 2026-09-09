/**
 * Client-side wrapper around the simulation worker with a main-thread fallback.
 * Provides a simple promise-based run() with progress + cancellation.
 */
"use client";

import type { GridResult, GridSpec, ApInput, WallInput, EngineConfig } from "@/rf/engine";
import type { Band } from "@/rf/pathloss";
import type { SimOutgoing } from "./simulation.worker";

export interface RunArgs {
  spec: GridSpec;
  band: Band;
  aps: ApInput[];
  walls: WallInput[];
  config: EngineConfig;
  onProgress?: (fraction: number) => void;
}

export interface RunHandle {
  promise: Promise<GridResult>;
  cancel: () => void;
}

let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./simulation.worker.ts", import.meta.url));
  }
  return worker;
}

export function runSimulation(args: RunArgs): RunHandle {
  const jobId = Math.random().toString(36).slice(2);
  const w = getWorker();

  if (!w) {
    // Main-thread fallback (used in non-worker environments / tests).
    const promise = import("@/rf/engine").then(({ computeGrid }) =>
      computeGrid(args.spec, args.band, args.aps, args.walls, args.config, args.onProgress),
    );
    return { promise, cancel: () => {} };
  }

  const promise = new Promise<GridResult>((resolve) => {
    const handler = (e: MessageEvent<SimOutgoing>) => {
      const msg = e.data;
      if (msg.jobId !== jobId) return;
      if (msg.type === "progress") args.onProgress?.(msg.fraction);
      if (msg.type === "done") {
        w.removeEventListener("message", handler);
        resolve(msg.result);
      }
    };
    w.addEventListener("message", handler);
    w.postMessage({
      type: "simulate",
      jobId,
      spec: args.spec,
      band: args.band,
      aps: args.aps,
      walls: args.walls,
      config: args.config,
    });
  });

  return {
    promise,
    cancel: () => w.postMessage({ type: "cancel", jobId }),
  };
}
