"use client";

import { useMemo, useState } from "react";
import { loadCatalog } from "@/catalog";
import type { ApProduct } from "@/catalog/schema";

/**
 * Professional AP model selector: search + filters, compact-list and card views,
 * favorites/recents, and side-by-side comparison of up to 3 models. Used both
 * during placement and when changing an existing AP's model. See override §2.
 */
export function ModelSelector({
  onChoose,
  onCancel,
  currentProductId,
}: {
  onChoose: (productId: string) => void;
  onCancel: () => void;
  currentProductId?: string;
}) {
  const catalog = loadCatalog();
  const [q, setQ] = useState("");
  const [gen, setGen] = useState("all");
  const [band, setBand] = useState("all");
  const [env, setEnv] = useState("all");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [compare, setCompare] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return catalog.products.filter((p) => {
      if (gen !== "all" && p.wifiGeneration !== gen) return false;
      if (band !== "all" && !p.supportedBands.includes(band as "2.4" | "5" | "6")) return false;
      if (env !== "all" && p.environment !== env) return false;
      if (q) {
        const hay = `${p.manufacturer} ${p.family} ${p.model} ${p.sku}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [catalog.products, gen, band, env, q]);

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 3 ? [...c, id] : c));
  }

  const compareProducts = compare
    .map((id) => catalog.products.find((p) => p.id === id))
    .filter((p): p is ApProduct => !!p);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Select AP model"
    >
      <div className="panel flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-border px-4 py-2">
          <h2 className="text-sm font-semibold">Select access-point model</h2>
          <button
            className="text-base-muted hover:text-base-text"
            onClick={onCancel}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-base-border p-3 text-xs">
          <input
            className="input flex-1"
            placeholder="Search manufacturer, family, model, SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="input !w-auto" value={gen} onChange={(e) => setGen(e.target.value)}>
            <option value="all">All gen</option>
            <option>Wi-Fi 6</option>
            <option>Wi-Fi 6E</option>
            <option>Wi-Fi 7</option>
          </select>
          <select className="input !w-auto" value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="all">All bands</option>
            <option value="2.4">2.4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
          <select className="input !w-auto" value={env} onChange={(e) => setEnv(e.target.value)}>
            <option value="all">In/Out</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
          <button
            className="btn !py-1"
            onClick={() => setView(view === "cards" ? "list" : "cards")}
          >
            {view === "cards" ? "List" : "Cards"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className={view === "cards" ? "grid grid-cols-2 gap-2 lg:grid-cols-3" : "space-y-1"}>
            {filtered.map((p) => (
              <div
                key={p.id}
                className={`rounded-md border p-2 ${p.id === currentProductId ? "border-accent" : "border-base-border"}`}
                data-testid={`model-${p.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{p.model}</div>
                    <div className="text-[10px] text-base-muted">
                      {p.wifiGeneration} · {p.supportedBands.join("/")} GHz · {p.environment} ·{" "}
                      {p.antenna.pattern} · {p.managementMode}
                    </div>
                    <div className="text-[10px] text-base-muted">
                      SKU {p.sku} · {p.radios.length} radios ·{" "}
                      <span className="text-yellow-300">{p.verified ? "verified" : "sample"}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <button
                    className="btn btn-primary flex-1 !py-1 !text-xs"
                    onClick={() => onChoose(p.id)}
                  >
                    {p.id === currentProductId ? "Keep" : "Choose"}
                  </button>
                  <label className="btn !py-1 !text-xs">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={compare.includes(p.id)}
                      onChange={() => toggleCompare(p.id)}
                    />
                    Compare
                  </label>
                  <a
                    className="btn !py-1 !text-xs"
                    href={p.datasheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="View datasheet"
                  >
                    ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {compareProducts.length >= 2 && (
          <div className="border-t border-base-border p-3">
            <h3 className="mb-1 text-xs font-semibold">Comparison ({compareProducts.length}/3)</h3>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-base-muted">
                  <th className="text-left">Spec</th>
                  {compareProducts.map((p) => (
                    <th key={p.id}>{p.model}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Generation", (p: ApProduct) => p.wifiGeneration],
                  ["Bands", (p: ApProduct) => p.supportedBands.join("/")],
                  [
                    "Max SS",
                    (p: ApProduct) => String(Math.max(...p.radios.map((r) => r.maxSpatialStreams))),
                  ],
                  ["Antenna", (p: ApProduct) => p.antenna.pattern],
                  ["Env", (p: ApProduct) => p.environment],
                  ["Mgmt", (p: ApProduct) => p.managementMode],
                ].map(([label, fn]) => (
                  <tr key={label as string}>
                    <td className="text-base-muted">{label as string}</td>
                    {compareProducts.map((p) => (
                      <td key={p.id} className="text-center">
                        {(fn as (p: ApProduct) => string)(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
