"use client";

import { useState, useEffect } from "react";
import type { AccessPoint } from "@/domain/model";
import { getProduct } from "@/catalog";
import { getDomain, allowedChannels } from "@/regulatory/domains";
import { AntennaPatternSection } from "@/components/antenna/AntennaPatternSection";

export type ApEditorTab = "properties" | "radios" | "pattern";

interface Props {
  ap: AccessPoint;
  regulatoryDomain: string;
  allowDfs: boolean;
  onChange: (mutate: (ap: AccessPoint) => void) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onChangeModel?: () => void;
  defaultTab?: ApEditorTab;
}

export function ApProperties({
  ap,
  regulatoryDomain,
  allowDfs,
  onChange,
  onDelete,
  onDuplicate,
  onChangeModel,
  defaultTab = "properties",
}: Props) {
  const product = getProduct(ap.productId);
  const domain = getDomain(regulatoryDomain);
  const [tab, setTab] = useState<ApEditorTab>(defaultTab);
  useEffect(() => setTab(defaultTab), [defaultTab, ap.id]);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex gap-1 border-b border-base-border text-xs">
        {(["properties", "radios", "pattern"] as ApEditorTab[]).map((t) => (
          <button
            key={t}
            className={`flex-1 py-1.5 capitalize ${tab === t ? "border-b-2 border-accent text-accent" : "text-base-muted"}`}
            onClick={() => setTab(t)}
            data-testid={`ap-tab-${t}`}
          >
            {t}
          </button>
        ))}
      </div>

      {ap.modelOverrideWarnings.length > 0 && (
        <div className="rounded border border-yellow-600/40 bg-yellow-500/10 p-2 text-[11px] text-yellow-200">
          {ap.modelOverrideWarnings.map((w, i) => (
            <div key={i}>! {w}</div>
          ))}
        </div>
      )}

      {tab === "pattern" && <AntennaPatternSection ap={ap} />}

      {tab === "radios" && (
        <RadiosTab
          ap={ap}
          product={product}
          domain={domain}
          allowDfs={allowDfs}
          onChange={onChange}
        />
      )}

      {tab === "properties" && (
        <PropertiesTab
          ap={ap}
          product={product}
          onChange={onChange}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onChangeModel={onChangeModel}
        />
      )}
    </div>
  );
}

function PropertiesTab({
  ap,
  product,
  onChange,
  onDelete,
  onDuplicate,
  onChangeModel,
}: {
  ap: AccessPoint;
  product: ReturnType<typeof getProduct>;
  onChange: (mutate: (ap: AccessPoint) => void) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onChangeModel?: () => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="label">AP name</label>
        <input
          className="input"
          value={ap.name}
          onChange={(e) => onChange((a) => (a.name = e.target.value))}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-base-muted">
        <span>
          Model: <span className="text-base-text">{product?.model ?? ap.productId}</span> ·{" "}
          {product?.wifiGeneration}
        </span>
        {onChangeModel && (
          <button
            className="btn !py-0.5 !text-xs"
            onClick={onChangeModel}
            data-testid="change-model"
          >
            Change model
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Mounting</label>
          <select
            className="input"
            value={ap.mountingType}
            onChange={(e) =>
              onChange((a) => (a.mountingType = e.target.value as AccessPoint["mountingType"]))
            }
          >
            {["ceiling", "wall", "pole", "outdoor"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Height (m)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={ap.mountingHeightM}
            onChange={(e) => onChange((a) => (a.mountingHeightM = Number(e.target.value)))}
          />
        </div>
      </div>

      <div>
        <label className="label">Rotation (°)</label>
        <input
          type="range"
          min={0}
          max={359}
          value={ap.rotationDeg}
          onChange={(e) => onChange((a) => (a.rotationDeg = Number(e.target.value)))}
          className="w-full"
        />
        <span className="text-xs text-base-muted">{ap.rotationDeg}°</span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-base-muted">
          Installation details
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="input"
            placeholder="Asset tag"
            value={ap.assetTag ?? ""}
            onChange={(e) => onChange((a) => (a.assetTag = e.target.value))}
          />
          <input
            className="input"
            placeholder="Switch"
            value={ap.switchName ?? ""}
            onChange={(e) => onChange((a) => (a.switchName = e.target.value))}
          />
          <input
            className="input"
            placeholder="Port"
            value={ap.switchPort ?? ""}
            onChange={(e) => onChange((a) => (a.switchPort = e.target.value))}
          />
          <input
            className="input"
            placeholder="IP address"
            value={ap.ipAddress ?? ""}
            onChange={(e) => onChange((a) => (a.ipAddress = e.target.value))}
          />
          <select
            className="input col-span-2"
            value={ap.installStatus}
            onChange={(e) =>
              onChange((a) => (a.installStatus = e.target.value as AccessPoint["installStatus"]))
            }
          >
            {["planned", "installed", "verified"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </details>

      <div className="flex gap-2">
        <button className="btn flex-1" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="btn flex-1" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function RadiosTab({
  ap,
  product,
  domain,
  allowDfs,
  onChange,
}: {
  ap: AccessPoint;
  product: ReturnType<typeof getProduct>;
  domain: ReturnType<typeof getDomain>;
  allowDfs: boolean;
  onChange: (mutate: (ap: AccessPoint) => void) => void;
}) {
  return (
    <div className="space-y-3">
      {ap.radios.map((radio, idx) => {
        const supportsBand = product?.supportedBands.includes(radio.band) ?? true;
        const radioSpec = product?.radios.find((r) => r.band === radio.band);
        const channels = allowedChannels(domain, radio.band, allowDfs);
        const overPower = radioSpec ? radio.txPowerDbm > radioSpec.maxTxPowerDbm : false;
        return (
          <div key={radio.band} className="rounded-md border border-base-border p-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={radio.enabled}
                  onChange={(e) => onChange((a) => (a.radios[idx]!.enabled = e.target.checked))}
                />
                {radio.band} GHz
              </label>
              {!supportsBand && (
                <span className="text-[10px] text-red-400">not supported by model</span>
              )}
            </div>
            {radio.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Channel</label>
                  <select
                    className="input"
                    value={radio.channel}
                    onChange={(e) =>
                      onChange((a) => {
                        const ch = Number(e.target.value);
                        a.radios[idx]!.channel = ch;
                        a.radios[idx]!.channelAuto = ch === 0;
                      })
                    }
                  >
                    <option value={0}>Auto</option>
                    {channels.map((c) => (
                      <option key={c.channel} value={c.channel}>
                        {c.channel}
                        {c.dfs ? " (DFS)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Width (MHz)</label>
                  <select
                    className="input"
                    value={radio.channelWidthMHz}
                    onChange={(e) =>
                      onChange((a) => (a.radios[idx]!.channelWidthMHz = Number(e.target.value)))
                    }
                  >
                    {(radioSpec?.supportedChannelWidthsMHz ?? [20, 40, 80]).map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">
                    Tx power (dBm)
                    {overPower && <span className="text-red-400"> exceeds model max</span>}
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={radio.txPowerDbm}
                    onChange={(e) =>
                      onChange((a) => (a.radios[idx]!.txPowerDbm = Number(e.target.value)))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
