"use client";

import { useState } from "react";
import type { AccessPoint } from "@/domain/model";
import { getProduct } from "@/catalog";
import { selectPattern } from "@/antenna/select";
import { PolarPlot } from "./PolarPlot";
import type { Band } from "@/rf/pathloss";

/**
 * Antenna-pattern section for the AP editor. Shows the model-specific pattern
 * selected for the chosen radio, its verification status, source datasheet link,
 * polar plots, and a visible warning when a fallback is used. Rotating the AP
 * rotates the preview. See override §6.
 */
export function AntennaPatternSection({ ap }: { ap: AccessPoint }) {
  const product = getProduct(ap.productId);
  const bands = ap.radios.map((r) => r.band);
  const [band, setBand] = useState<Band>(bands[0] ?? "5");

  if (!product) return <p className="text-xs text-base-muted">No product data.</p>;

  const antenna = product.antenna.integrated ? "integrated" : "external";
  const selection = selectPattern({
    product,
    band,
    antenna,
    mountingMode: ap.mountingType,
    orientation: ap.orientationAzimuthDegrees % 180 === 0 ? "horizontal" : "vertical",
  });
  const fp = selection.pattern.patterns[0]!;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <label className="label !mb-0">Radio</label>
        <select
          className="input !w-auto !py-1"
          value={band}
          onChange={(e) => setBand(e.target.value as Band)}
        >
          {bands.map((b) => (
            <option key={b} value={b}>
              {b} GHz
            </option>
          ))}
        </select>
      </div>

      {selection.isFallback && (
        <div
          className="rounded-md border border-yellow-600/50 bg-yellow-500/10 p-2 text-[11px] text-yellow-200"
          data-testid="fallback-warning"
        >
          {selection.warning}
          {selection.fallbackReason && (
            <div className="mt-1 opacity-80">Reason: {selection.fallbackReason}</div>
          )}
        </div>
      )}
      {!selection.isFallback && selection.warning && (
        <div className="rounded-md border border-base-border p-2 text-[11px] text-base-muted">
          {selection.warning}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-base-muted">Pattern</dt>
        <dd>{selection.pattern.antenna.name}</dd>
        <dt className="text-base-muted">Revision</dt>
        <dd>{selection.pattern.revision}</dd>
        <dt className="text-base-muted">Status</dt>
        <dd className="text-yellow-300">{selection.pattern.verificationStatus}</dd>
        <dt className="text-base-muted">Peak gain</dt>
        <dd>{fp.peakGainDbi.toFixed(1)} dBi</dd>
        <dt className="text-base-muted">Polarization</dt>
        <dd>{selection.pattern.antenna.polarization}</dd>
        <dt className="text-base-muted">Mounting</dt>
        <dd>{ap.mountingType}</dd>
      </dl>

      <div className="flex justify-around">
        <PolarPlot
          samples={fp.azimuth}
          peakGainDbi={fp.peakGainDbi}
          rotationDeg={ap.rotationDeg}
          label="Azimuth"
          size={150}
        />
        <PolarPlot
          samples={fp.elevation}
          peakGainDbi={fp.peakGainDbi}
          label="Elevation"
          size={150}
        />
      </div>

      <a
        className="btn w-full justify-center !py-1 !text-xs"
        href={product.datasheetUrl}
        target="_blank"
        rel="noreferrer"
        data-testid="view-datasheet"
      >
        View source datasheet ↗
      </a>
      <p className="text-[10px] text-base-muted">
        Pattern is sample data. Verify against official Cisco documentation before relying on it.
      </p>
    </div>
  );
}
