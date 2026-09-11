"use client";

import type { Tool } from "@/store/editor";
import { type ToolbarMode, cycleToolbarMode, toolbarModeLabel } from "@/lib/toolbar-prefs";

interface ToolDef {
  id: Tool | "opening" | "inspect";
  label: string;
  glyph: string;
  shortcut: string;
}

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", glyph: "▤", shortcut: "V" },
  { id: "pan", label: "Pan", glyph: "✋", shortcut: "H" },
  { id: "scale", label: "Scale", glyph: "⇔", shortcut: "K" },
  { id: "measure", label: "Measure", glyph: "📏", shortcut: "M" },
  { id: "wall", label: "Draw wall", glyph: "▭", shortcut: "W" },
  { id: "area", label: "Attenuation region", glyph: "▧", shortcut: "R" },
  { id: "annotate", label: "Requirement zone", glyph: "◎", shortcut: "Z" },
  { id: "ap", label: "Add AP", glyph: "◉", shortcut: "A" },
  { id: "opening", label: "Door / opening", glyph: "⊓", shortcut: "D" },
  { id: "inspect", label: "Inspect point", glyph: "⌖", shortcut: "I" },
];

export function BottomToolbar({
  active,
  onSelect,
  pinContinuous,
  onTogglePin,
  contextual,
  mode = "expanded",
  onChangeMode,
}: {
  active: Tool | "opening" | "inspect";
  onSelect: (t: Tool | "opening" | "inspect") => void;
  pinContinuous: boolean;
  onTogglePin: () => void;
  contextual?: React.ReactNode;
  /** expanded | compact | hidden (focus mode). Defaults to expanded. */
  mode?: ToolbarMode;
  onChangeMode?: (m: ToolbarMode) => void;
}) {
  // Focus mode: hide the toolbar to maximize canvas, but ALWAYS render a small
  // restore control so the user can never be trapped (override §4).
  if (mode === "hidden") {
    return (
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <button
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-base-border bg-base-panel px-3 py-1.5 text-xs text-base-muted shadow-lg hover:text-base-text"
          style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
          onClick={() => onChangeMode?.("expanded")}
          data-testid="toolbar-restore"
          title="Show design tools (F)"
          aria-label="Show design tools"
        >
          <span aria-hidden>▴</span> Show tools
        </button>
      </div>
    );
  }

  const compact = mode === "compact";

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      {contextual && (
        <div
          className="pointer-events-auto panel px-3 py-1.5 text-xs shadow-lg"
          style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
        >
          {contextual}
        </div>
      )}
      <div
        className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-base-border bg-base-panel p-1"
        style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }}
        role="toolbar"
        aria-label="Design tools"
      >
        {TOOLS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={isActive}
              data-testid={`tool-${t.id}`}
              title={`${t.label} (${t.shortcut})`}
              className={`flex flex-col items-center justify-center rounded-md transition-colors ${
                compact ? "h-9 min-w-[36px] px-1.5" : "h-11 min-w-[52px] px-2 text-[10px]"
              } ${
                isActive
                  ? "bg-accent text-white"
                  : "text-base-muted hover:bg-base-border hover:text-base-text"
              }`}
            >
              <span className="text-sm" aria-hidden>
                {t.glyph}
              </span>
              {!compact && <span className="mt-0.5">{t.label.split(" ")[0]}</span>}
            </button>
          );
        })}
        <div className="mx-1 h-8 w-px bg-base-border" />
        <button
          onClick={onTogglePin}
          aria-pressed={pinContinuous}
          title="Keep drawing tool active after each shape (continuous mode)"
          className={`flex flex-col items-center justify-center rounded-md ${
            compact ? "h-9 min-w-[36px] px-1.5" : "h-11 min-w-[52px] px-2 text-[10px]"
          } ${pinContinuous ? "bg-accent/20 text-accent" : "text-base-muted hover:bg-base-border"}`}
        >
          <span className="text-sm" aria-hidden>
            {pinContinuous ? "📌" : "📍"}
          </span>
          {!compact && <span className="mt-0.5">{pinContinuous ? "Pinned" : "One-shot"}</span>}
        </button>

        {/* Collapse control: cycles expanded → compact → hidden (focus). */}
        <button
          onClick={() => onChangeMode?.(cycleToolbarMode(mode))}
          title={`${toolbarModeLabel(mode)} — click to change`}
          aria-label={toolbarModeLabel(mode)}
          data-testid="toolbar-collapse"
          className={`flex flex-col items-center justify-center rounded-md text-base-muted hover:bg-base-border hover:text-base-text ${
            compact ? "h-9 min-w-[36px] px-1.5" : "h-11 min-w-[44px] px-2 text-[10px]"
          }`}
        >
          <span className="text-sm" aria-hidden>
            {compact ? "▸" : "▾"}
          </span>
          {!compact && <span className="mt-0.5">Collapse</span>}
        </button>
      </div>
    </div>
  );
}
