"use client";

import { useMemo, useState } from "react";
import { loadCatalog } from "@/catalog";
import type { ApProduct } from "@/catalog/schema";

/**
 * AP library with search, filters, favorites, verification badges, and
 * click-to-place. Cards show model, generation, bands, environment, antenna,
 * management mode, and verification status. See requirements.md §5 / §14.11.
 */
export function ApLibrary({
  onPlace,
  onReplaceSelected,
  hasSelection,
}: {
  onPlace: (productId: string) => void;
  onReplaceSelected: (productId: string) => void;
  hasSelection: boolean;
}) {
  const catalog = loadCatalog();
  const [q, setQ] = useState("");
  const [gen, setGen] = useState<string>("all");
  const [bandFilter, setBandFilter] = useState<string>("all");
  const [env, setEnv] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return catalog.products.filter((p) => {
      if (gen !== "all" && p.wifiGeneration !== gen) return false;
      if (bandFilter !== "all" && !p.supportedBands.includes(bandFilter as "2.4" | "5" | "6"))
        return false;
      if (env !== "all" && p.environment !== env) return false;
      if (q) {
        const hay = `${p.model} ${p.sku} ${p.family}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [catalog.products, gen, bandFilter, env, q]);

  const ordered = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)),
      ),
    [filtered, favorites],
  );

  function toggleFav(id: string) {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-yellow-600/40 bg-yellow-500/10 p-2 text-[11px] text-yellow-200">
        Catalog data is sample/unverified. Verify with official Cisco documentation.
      </div>
      <input
        className="input"
        placeholder="Search model or SKU…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search access points"
      />
      <div className="grid grid-cols-3 gap-1 text-xs">
        <select
          className="input !py-1"
          value={gen}
          onChange={(e) => setGen(e.target.value)}
          aria-label="Generation"
        >
          <option value="all">All gen</option>
          <option>Wi-Fi 6</option>
          <option>Wi-Fi 6E</option>
          <option>Wi-Fi 7</option>
        </select>
        <select
          className="input !py-1"
          value={bandFilter}
          onChange={(e) => setBandFilter(e.target.value)}
          aria-label="Band"
        >
          <option value="all">All bands</option>
          <option value="2.4">2.4</option>
          <option value="5">5</option>
          <option value="6">6</option>
        </select>
        <select
          className="input !py-1"
          value={env}
          onChange={(e) => setEnv(e.target.value)}
          aria-label="Environment"
        >
          <option value="all">In/Out</option>
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
        </select>
      </div>

      <ul className="space-y-2">
        {ordered.length === 0 && (
          <li className="py-4 text-center text-xs text-base-muted">No matching models.</li>
        )}
        {ordered.map((p) => (
          <li key={p.id}>
            <ApCard
              product={p}
              favorite={favorites.includes(p.id)}
              onToggleFav={() => toggleFav(p.id)}
              onPlace={() => onPlace(p.id)}
              onReplace={hasSelection ? () => onReplaceSelected(p.id) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApCard({
  product,
  favorite,
  onToggleFav,
  onPlace,
  onReplace,
}: {
  product: ApProduct;
  favorite: boolean;
  onToggleFav: () => void;
  onPlace: () => void;
  onReplace?: () => void;
}) {
  return (
    <div className="rounded-md border border-base-border p-2 hover:border-base-muted">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {product.model}
            <span className="rounded bg-yellow-500/20 px-1 text-[9px] text-yellow-200">
              {product.verified ? "verified" : "sample"}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-base-muted">
            {product.wifiGeneration} · {product.supportedBands.join("/")} GHz ·{" "}
            {product.environment} · {product.antenna.pattern} · {product.managementMode}
          </div>
        </div>
        <button
          className={`text-sm ${favorite ? "text-yellow-300" : "text-base-muted"}`}
          onClick={onToggleFav}
          title="Pin favorite"
          aria-pressed={favorite}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
      <div className="mt-2 flex gap-1">
        <button className="btn flex-1 !py-1 !text-xs" onClick={onPlace}>
          Place
        </button>
        {onReplace && (
          <button
            className="btn flex-1 !py-1 !text-xs"
            onClick={onReplace}
            title="Replace selected AP (keeps location)"
          >
            Replace selected
          </button>
        )}
      </div>
    </div>
  );
}
