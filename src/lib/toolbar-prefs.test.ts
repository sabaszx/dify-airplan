// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_TOOLBAR_MODE,
  cycleToolbarMode,
  toggleFocusMode,
  toolbarModeLabel,
  loadToolbarMode,
  saveToolbarMode,
} from "./toolbar-prefs";

describe("toolbar preferences (§4)", () => {
  beforeEach(() => window.localStorage.clear());

  it("cycles expanded → compact → hidden → expanded", () => {
    expect(cycleToolbarMode("expanded")).toBe("compact");
    expect(cycleToolbarMode("compact")).toBe("hidden");
    expect(cycleToolbarMode("hidden")).toBe("expanded");
  });

  it("focus toggle hides from any visible state and restores from hidden", () => {
    expect(toggleFocusMode("expanded")).toBe("hidden");
    expect(toggleFocusMode("compact")).toBe("hidden");
    // Restoring from hidden goes back to a visible state (never traps).
    expect(toggleFocusMode("hidden")).toBe("expanded");
  });

  it("every mode has a human label", () => {
    expect(toolbarModeLabel("expanded")).toMatch(/label/i);
    expect(toolbarModeLabel("compact")).toMatch(/compact/i);
    expect(toolbarModeLabel("hidden")).toMatch(/focus/i);
  });

  it("persists and reloads the preference; defaults on missing/invalid", () => {
    expect(loadToolbarMode()).toBe(DEFAULT_TOOLBAR_MODE);
    saveToolbarMode("compact");
    expect(loadToolbarMode()).toBe("compact");
    window.localStorage.setItem("cwp:toolbar-mode", "nonsense");
    expect(loadToolbarMode()).toBe(DEFAULT_TOOLBAR_MODE);
  });
});
