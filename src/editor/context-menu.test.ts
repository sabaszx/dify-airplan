import { describe, it, expect } from "vitest";
import { menuForKind, clampMenuPosition } from "./context-menu";

describe("context menu definitions (object-aware)", () => {
  it("AP menu contains AP actions, not wall actions", () => {
    const ids = menuForKind("access-point").map((i) => i.actionId);
    expect(ids).toContain("ap.edit");
    expect(ids).toContain("ap.changeModel");
    expect(ids).not.toContain("wall.edit");
  });

  it("wall menu contains wall actions, not AP actions", () => {
    const ids = menuForKind("wall").map((i) => i.actionId);
    expect(ids).toContain("wall.edit");
    expect(ids).toContain("wall.changeMaterial");
    expect(ids).not.toContain("ap.edit");
  });

  it("empty canvas menu offers Paste and Add Access Point Here", () => {
    const ids = menuForKind("empty").map((i) => i.actionId);
    expect(ids).toContain("canvas.paste");
    expect(ids).toContain("canvas.addAp");
  });

  it("marks delete as destructive", () => {
    const del = menuForKind("access-point").find((i) => i.actionId === "ap.delete");
    expect(del?.destructive).toBe(true);
  });

  it("adds Select Behind / Select From List when objects overlap", () => {
    const items = menuForKind("access-point", {
      overlap: [
        { actionId: "pick:ap1", label: "AP-1" },
        { actionId: "pick:w1", label: "Wall" },
      ],
    });
    const ids = items.map((i) => i.actionId);
    expect(ids).toContain("select.behind");
    const fromList = items.find((i) => i.actionId === "select.fromList");
    expect(fromList?.submenu?.length).toBe(2);
  });
});

describe("viewport clamping (mandatory: stay inside viewport)", () => {
  const viewport = { width: 1000, height: 800 };
  const menu = { width: 220, height: 300 };

  it("keeps a near-right-edge menu inside the viewport", () => {
    const pos = clampMenuPosition({ x: 950, y: 100 }, menu, viewport);
    expect(pos.x + menu.width).toBeLessThanOrEqual(viewport.width);
  });

  it("keeps a near-bottom menu inside the viewport", () => {
    const pos = clampMenuPosition({ x: 100, y: 780 }, menu, viewport);
    expect(pos.y + menu.height).toBeLessThanOrEqual(viewport.height);
  });

  it("does not move a comfortably-placed menu", () => {
    const pos = clampMenuPosition({ x: 200, y: 200 }, menu, viewport);
    expect(pos).toEqual({ x: 200, y: 200 });
  });
});
