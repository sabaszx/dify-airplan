"use client";

export type Workspace =
  | "overview"
  | "floorplans"
  | "design"
  | "requirements"
  | "analysis"
  | "inventory"
  | "reports"
  | "catalog"
  | "settings";

const ITEMS: { id: Workspace; label: string; glyph: string }[] = [
  { id: "overview", label: "Overview", glyph: "◫" },
  { id: "floorplans", label: "Floor plans", glyph: "▤" },
  { id: "design", label: "Design", glyph: "✎" },
  { id: "requirements", label: "Requirements", glyph: "◎" },
  { id: "analysis", label: "Analysis", glyph: "◈" },
  { id: "inventory", label: "Inventory / BOM", glyph: "☰" },
  { id: "reports", label: "Reports", glyph: "▦" },
  { id: "catalog", label: "Product catalog", glyph: "⌗" },
  { id: "settings", label: "Settings", glyph: "⚙" },
];

export function NavRail({
  active,
  onChange,
}: {
  active: Workspace;
  onChange: (w: Workspace) => void;
}) {
  return (
    <nav
      className="flex w-14 flex-col items-center gap-1 border-r border-base-border bg-base-panel py-2"
      aria-label="Primary"
    >
      {ITEMS.map((it) => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            aria-current={isActive ? "page" : undefined}
            title={it.label}
            className={`group relative flex h-11 w-11 flex-col items-center justify-center rounded-md text-[9px] leading-tight transition-colors ${
              isActive
                ? "bg-accent/20 text-accent"
                : "text-base-muted hover:bg-base-border hover:text-base-text"
            }`}
          >
            {isActive && <span className="absolute left-0 top-1.5 h-8 w-0.5 rounded-r bg-accent" />}
            <span className="text-base" aria-hidden>
              {it.glyph}
            </span>
            <span className="mt-0.5 max-w-[44px] truncate">{it.label.split(" ")[0]}</span>
          </button>
        );
      })}
    </nav>
  );
}
