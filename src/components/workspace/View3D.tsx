"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Scenario } from "@/domain/model";
import type { LayerVisibility } from "@/lib/layer-visibility";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { isWebGLAvailable } from "@/3d/webgl";
import { scene3dFloorList } from "@/3d/scene";

/**
 * 3D view wrapper. The heavy Three.js scene is dynamically imported so it does
 * NOT increase the initial 2D editor bundle. WebGL support is checked first and
 * a graceful fallback is shown when unavailable; an error boundary guarantees a
 * 3D failure never crashes the rest of the editor. See override §6.
 */
const Scene3DCanvasInner = dynamic(
  () => import("@/3d/Scene3DCanvasInner").then((m) => m.Scene3DCanvasInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-base-muted">
        Loading 3D…
      </div>
    ),
  },
);

export type View3DMode = "floor" | "building";

export function View3D({
  scenario,
  activeFloorId,
  layerVisibility,
  onSelectFloor,
}: {
  scenario: Scenario;
  activeFloorId: string | null;
  layerVisibility: LayerVisibility;
  onSelectFloor?: (floorId: string) => void;
}) {
  const [mode, setMode] = useState<View3DMode>("building");
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [wallOpacity, setWallOpacity] = useState(0.9);
  const [floorOpacity, setFloorOpacity] = useState(0.4);

  useEffect(() => {
    setWebgl(isWebGLAvailable());
  }, []);

  const floors = scene3dFloorList(scenario);

  if (webgl === false) {
    return (
      <Fallback message="3D view is unavailable because WebGL is not supported in this browser or is disabled. The 2D editor is unaffected." />
    );
  }

  return (
    <div className="relative h-full w-full bg-base-bg">
      {/* Controls */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border border-base-border bg-base-panel/90 p-1 text-xs">
        {(["building", "floor"] as View3DMode[]).map((m) => (
          <button
            key={m}
            className={`rounded px-2 py-0.5 capitalize ${mode === m ? "bg-accent text-white" : "text-base-muted hover:text-base-text"}`}
            onClick={() => setMode(m)}
          >
            3D {m}
          </button>
        ))}
        {mode === "floor" && (
          <select
            className="input !w-auto !py-0.5 !text-xs"
            value={activeFloorId ?? ""}
            onChange={(e) => onSelectFloor?.(e.target.value)}
            aria-label="3D floor"
          >
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-md border border-base-border bg-base-panel/90 p-2 text-[11px]">
        <label className="flex items-center justify-between gap-2">
          Walls
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={wallOpacity}
            onChange={(e) => setWallOpacity(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          Floors
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={floorOpacity}
            onChange={(e) => setFloorOpacity(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded bg-black/50 px-2 py-1 text-[10px] text-base-muted">
        3D is a read-only visualization derived from the 2D design. Edit in 2D. Signal volumes shown
        here are conceptual, not measured RF.
      </div>

      <ErrorBoundary
        label="3d-view"
        fallback={(err, reset) => (
          <Fallback
            message={`The 3D view failed to render (${err.message}). The 2D editor is unaffected.`}
            onRetry={reset}
          />
        )}
      >
        <Scene3DCanvasInner
          scenario={scenario}
          mode={mode}
          floorId={activeFloorId ?? undefined}
          layerVisibility={layerVisibility}
          onSelectFloor={onSelectFloor}
          wallOpacity={wallOpacity}
          floorOpacity={floorOpacity}
        />
      </ErrorBoundary>
    </div>
  );
}

function Fallback({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-base-bg px-6 text-center text-sm text-base-muted">
      <p className="max-w-md">{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Retry 3D
        </button>
      )}
    </div>
  );
}
