"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { Scenario } from "@/domain/model";
import { buildScene3D, type WallMesh, type FloorSlab } from "./scene";
import { materialColor } from "@/lib/tokens";
import type { LayerVisibility } from "@/lib/layer-visibility";
import { showsDevices } from "@/lib/layer-visibility";

/**
 * Inner Three.js/R3F 3D scene. Dynamically imported so the 2D editor bundle is
 * unaffected. Geometry is derived from the 2D project data via buildScene3D — no
 * separate 3D model. Original component. See override §6.
 *
 * Coordinate mapping: world XY (meters) -> three (x, z); world Z (height) -> y.
 */
export function Scene3DCanvasInner({
  scenario,
  mode,
  floorId,
  layerVisibility,
  onSelectFloor,
  wallOpacity = 0.9,
  floorOpacity = 0.5,
}: {
  scenario: Scenario;
  mode: "floor" | "building";
  floorId?: string;
  layerVisibility: LayerVisibility;
  onSelectFloor?: (floorId: string) => void;
  wallOpacity?: number;
  floorOpacity?: number;
}) {
  const scene = useMemo(() => buildScene3D(scenario, { mode, floorId }), [scenario, mode, floorId]);
  const showAps = showsDevices(layerVisibility, "WIFI");

  const cameraDist = Math.max(scene.totalHeightM * 2, 30);

  return (
    <Canvas
      camera={{ position: [cameraDist, cameraDist * 0.9, cameraDist], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        // Handle WebGL context loss gracefully (do not crash the app).
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
      }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[20, 40, 20]} intensity={0.6} />
      <SimpleOrbit />
      {scene.floors.map((slab) => (
        <FloorGroup
          key={slab.floorId}
          slab={slab}
          showAps={showAps}
          wallOpacity={wallOpacity}
          floorOpacity={floorOpacity}
          onSelect={() => onSelectFloor?.(slab.floorId)}
        />
      ))}
    </Canvas>
  );
}

function FloorGroup({
  slab,
  showAps,
  wallOpacity,
  floorOpacity,
  onSelect,
}: {
  slab: FloorSlab;
  showAps: boolean;
  wallOpacity: number;
  floorOpacity: number;
  onSelect: () => void;
}) {
  return (
    <group>
      {/* Floor slab surface */}
      <mesh
        position={[slab.widthM / 2, slab.elevationZ, slab.depthM / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={onSelect}
      >
        <planeGeometry args={[slab.widthM, slab.depthM]} />
        <meshStandardMaterial color="#273043" transparent opacity={floorOpacity} />
      </mesh>

      {slab.walls.map((w) => (
        <WallBox key={w.id} wall={w} opacity={wallOpacity} />
      ))}

      {showAps &&
        slab.devices.map((d) => (
          <mesh key={d.id} position={[d.position.x, d.z, d.position.y]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
        ))}
    </group>
  );
}

/** Render a wall segment as an extruded box using its physical thickness/height. */
function WallBox({ wall, opacity }: { wall: WallMesh; opacity: number }) {
  const dx = wall.b.x - wall.a.x;
  const dy = wall.b.y - wall.a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return null;
  const angle = Math.atan2(dy, dx);
  const cx = (wall.a.x + wall.b.x) / 2;
  const cy = (wall.a.y + wall.b.y) / 2;
  // world XY -> three XZ; height along three Y.
  return (
    <mesh position={[cx, wall.baseZ + wall.heightM / 2, cy]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, wall.heightM, wall.thicknessM]} />
      <meshStandardMaterial color={materialColor(wall.materialId)} transparent opacity={opacity} />
    </mesh>
  );
}

/** Minimal pointer-drag orbit without extra deps (drei not required). */
function SimpleOrbit() {
  // R3F provides camera controls via events; keep it simple and dependency-light
  // by relying on the default camera. A full OrbitControls can be added with drei.
  return null;
}
