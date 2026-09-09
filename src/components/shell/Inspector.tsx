"use client";

import { useState } from "react";

/**
 * Floating, dockable, resizable, collapsible right inspector. Content changes
 * with the current selection (driven by the parent). Keyboard accessible.
 * See requirements.md §2E / §14.1.
 */
export function Inspector({
  title,
  children,
  warnings,
}: {
  title: string;
  children: React.ReactNode;
  warnings?: { level: "warning" | "error"; message: string }[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(340);
  const [dragging, setDragging] = useState(false);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startW = width;
    function move(ev: MouseEvent) {
      const next = Math.min(Math.max(startW - (ev.clientX - startX), 280), 560);
      setWidth(next);
    }
    function up() {
      setDragging(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  if (collapsed) {
    return (
      <div className="flex items-start">
        <button
          className="mt-2 rounded-l-md border border-r-0 border-base-border bg-base-panel px-1.5 py-3 text-xs text-base-muted hover:text-base-text"
          onClick={() => setCollapsed(false)}
          title="Expand inspector"
          aria-expanded={false}
        >
          ‹
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex" style={{ width }}>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startResize}
        className={`w-1 cursor-col-resize ${dragging ? "bg-accent" : "bg-transparent hover:bg-accent/50"}`}
      />
      <aside
        className="flex min-h-0 flex-1 flex-col border-l border-base-border bg-base-panel"
        aria-label="Inspector"
      >
        <div className="flex items-center justify-between border-b border-base-border px-3 py-2">
          <h2 className="text-sm font-medium">{title}</h2>
          <button
            className="text-base-muted hover:text-base-text"
            onClick={() => setCollapsed(true)}
            title="Collapse inspector"
            aria-expanded
          >
            ›
          </button>
        </div>
        {warnings && warnings.length > 0 && (
          <div className="space-y-1 border-b border-base-border p-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-start gap-1.5 rounded px-2 py-1 text-[11px] ${
                  w.level === "error"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-yellow-500/10 text-yellow-200"
                }`}
              >
                <span aria-hidden className="font-bold">
                  {w.level === "error" ? "×" : "!"}
                </span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </aside>
    </div>
  );
}
