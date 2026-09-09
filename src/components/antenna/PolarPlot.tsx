"use client";

import { interpolateCut } from "@/antenna/gain";
import type { AngleSample } from "@/antenna/schema";

/**
 * SVG polar plot of an antenna cut (azimuth or elevation). Renders relative gain
 * on rings from (peak) at the outer ring down to (peak - dynamicRangeDb) at the
 * center. Includes peak marker and optional boresight rotation. Accessible via
 * a text summary. Original component.
 */
export function PolarPlot({
  samples,
  peakGainDbi,
  dynamicRangeDb = 30,
  rotationDeg = 0,
  size = 200,
  label,
}: {
  samples: AngleSample[];
  peakGainDbi: number;
  dynamicRangeDb?: number;
  rotationDeg?: number;
  size?: number;
  label: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const minGain = peakGainDbi - dynamicRangeDb;

  // Radius (0..r) for a gain value.
  const radiusForGain = (g: number) => {
    const norm = (g - minGain) / (peakGainDbi - minGain);
    return Math.max(0, Math.min(1, norm)) * r;
  };

  // Sample the interpolated cut every 5 degrees for a smooth curve.
  const points: string[] = [];
  let peakAngle = 0;
  let peakVal = -Infinity;
  for (let a = 0; a <= 360; a += 5) {
    const g = interpolateCut(samples, a - rotationDeg);
    if (g > peakVal) {
      peakVal = g;
      peakAngle = a;
    }
    const rad = ((a - 90) * Math.PI) / 180; // 0° at top
    const rr = radiusForGain(g);
    points.push(`${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`);
  }

  const rings = [1, 0.66, 0.33];

  return (
    <figure className="m-0">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label} pattern. Peak ${peakGainDbi.toFixed(1)} dBi near ${peakAngle}°.`}
      >
        {/* Rings */}
        {rings.map((f, i) => (
          <circle key={i} cx={cx} cy={cy} r={r * f} fill="none" stroke="#273043" strokeWidth={1} />
        ))}
        {/* Cross axes */}
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#273043" />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#273043" />
        {/* Cardinal labels */}
        <text x={cx} y={cy - r - 4} fontSize={9} fill="#9aa7bd" textAnchor="middle">
          0°
        </text>
        <text x={cx + r + 4} y={cy + 3} fontSize={9} fill="#9aa7bd">
          90°
        </text>
        {/* Pattern curve */}
        <polygon
          points={points.join(" ")}
          fill="rgba(59,130,246,0.25)"
          stroke="#3b82f6"
          strokeWidth={1.5}
        />
        {/* Peak marker */}
        {(() => {
          const rad = ((peakAngle - 90) * Math.PI) / 180;
          const rr = radiusForGain(peakVal);
          return (
            <circle
              cx={cx + rr * Math.cos(rad)}
              cy={cy + rr * Math.sin(rad)}
              r={3}
              fill="#f0b429"
            />
          );
        })()}
      </svg>
      <figcaption className="mt-1 text-center text-[10px] text-base-muted">
        {label} · peak {peakGainDbi.toFixed(1)} dBi · {minGain.toFixed(0)}…{peakGainDbi.toFixed(0)}{" "}
        dBi range
      </figcaption>
    </figure>
  );
}
