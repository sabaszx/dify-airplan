import { describe, it, expect } from "vitest";
import { canPerform, allowsNegativeLoss, saveMaterial, createMaterial } from "./material-library";

describe("material permission model (§5)", () => {
  it("viewer is read-only; editor can do everything but hard-delete; admin can do all", () => {
    for (const a of ["create", "edit", "duplicate", "archive", "delete", "import"] as const) {
      expect(canPerform("viewer", a)).toBe(false);
    }
    expect(canPerform("editor", "create")).toBe(true);
    expect(canPerform("editor", "edit")).toBe(true);
    expect(canPerform("editor", "archive")).toBe(true);
    expect(canPerform("editor", "delete")).toBe(false); // hard delete is admin-only
    expect(canPerform("admin", "delete")).toBe(true);
  });

  it("only admins may use the negative-loss (gain) override", () => {
    expect(allowsNegativeLoss("admin")).toBe(true);
    expect(allowsNegativeLoss("editor")).toBe(false);
    expect(allowsNegativeLoss("viewer")).toBe(false);
  });
});

describe("saveMaterial (§5)", () => {
  const base = createMaterial(
    { name: "Brick", source: "datasheet", attenuationDb: { "2.4": 6, "5": 8, "6": 9 } },
    "t0",
  );

  it("adds a NEW material at version 1 (no spurious bump)", () => {
    const draft = createMaterial({ name: "Glass", source: "spec" }, "t0");
    const res = saveMaterial([], draft, { role: "editor", now: "t1" });
    expect(res.ok).toBe(true);
    expect(res.materials).toHaveLength(1);
    expect(res.materials[0]!.version).toBe(1);
  });

  it("bumps the revision on EDIT of an existing material", () => {
    const edited = { ...base, name: "Brick (fire-rated)" };
    const res = saveMaterial([base], edited, { role: "editor", now: "t2" });
    expect(res.ok).toBe(true);
    expect(res.materials[0]!.version).toBe((base.version ?? 1) + 1);
    expect(res.materials[0]!.updatedAt).toBe("t2");
    expect(res.materials[0]!.name).toBe("Brick (fire-rated)");
  });

  it("rejects a save from a viewer (permission denied), leaving the library unchanged", () => {
    const res = saveMaterial([base], { ...base, name: "x" }, { role: "viewer" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/viewer/i);
    expect(res.materials).toEqual([base]);
  });

  it("rejects invalid dB values (NaN) even for an editor", () => {
    const bad = { ...base, attenuationDb: { "2.4": Number.NaN, "5": 8, "6": 9 } };
    const res = saveMaterial([base], bad, { role: "editor" });
    expect(res.ok).toBe(false);
    expect(res.validation?.ok).toBe(false);
    expect(res.materials).toEqual([base]); // unchanged
  });

  it("does not mutate the input array", () => {
    const lib = [base];
    saveMaterial(lib, createMaterial({ name: "New", source: "s" }, "t0"), { role: "editor" });
    expect(lib).toHaveLength(1);
  });

  it("preserves the original author on edit (createdBy is not overwritten)", () => {
    const authored = createMaterial({ name: "Wood", source: "s" }, "t0", "alice");
    const res = saveMaterial(
      [authored],
      { ...authored, name: "Oak" },
      { role: "admin", by: "bob", now: "t3" },
    );
    expect(res.materials[0]!.createdBy).toBe("alice");
  });
});
