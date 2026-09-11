/**
 * Canvas toolbar display preference. A pure, testable model for the toolbar's
 * three states, persisted per view (localStorage). Focus mode hides the toolbar
 * to maximize canvas space, but a restore control is ALWAYS visible so the user
 * can never get trapped. See override §4. Original code.
 */

/** expanded = icons + labels · compact = icons only · hidden = focus mode. */
export type ToolbarMode = "expanded" | "compact" | "hidden";

export const DEFAULT_TOOLBAR_MODE: ToolbarMode = "expanded";

export const TOOLBAR_MODES: ToolbarMode[] = ["expanded", "compact", "hidden"];

/** Cycle expanded → compact → hidden → expanded (used by the collapse button). */
export function cycleToolbarMode(current: ToolbarMode): ToolbarMode {
  switch (current) {
    case "expanded":
      return "compact";
    case "compact":
      return "hidden";
    case "hidden":
      return "expanded";
    default:
      return "expanded";
  }
}

/** Focus-mode toggle: hidden → expanded (restore), anything else → hidden.
 *  Escape/shortcut use this. It NEVER leaves the user without a visible control
 *  because a restore pill is rendered whenever the mode is hidden. */
export function toggleFocusMode(current: ToolbarMode): ToolbarMode {
  return current === "hidden" ? "expanded" : "hidden";
}

/** Human label for the current mode (tooltip/aria). */
export function toolbarModeLabel(mode: ToolbarMode): string {
  switch (mode) {
    case "expanded":
      return "Toolbar: labels shown";
    case "compact":
      return "Toolbar: compact (icons only)";
    case "hidden":
      return "Toolbar hidden (focus mode)";
  }
}

const KEY = "cwp:toolbar-mode";

function isToolbarMode(v: unknown): v is ToolbarMode {
  return v === "expanded" || v === "compact" || v === "hidden";
}

export function loadToolbarMode(): ToolbarMode {
  if (typeof window === "undefined") return DEFAULT_TOOLBAR_MODE;
  try {
    const raw = window.localStorage.getItem(KEY);
    return isToolbarMode(raw) ? raw : DEFAULT_TOOLBAR_MODE;
  } catch {
    return DEFAULT_TOOLBAR_MODE;
  }
}

export function saveToolbarMode(mode: ToolbarMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* ignore quota/availability errors — preference is non-critical */
  }
}
