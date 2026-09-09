import { describe, it, expect } from "vitest";
import { selectPattern, genericSelection } from "./select";
import { getProduct } from "@/catalog";

describe("model-specific pattern selection hierarchy (mandatory)", () => {
  it("selects an exact model pattern when registered", () => {
    const product = getProduct("cat9166")!;
    const sel = selectPattern({
      product,
      band: "5",
      antenna: "integrated",
      mountingMode: "ceiling",
      orientation: "horizontal",
    });
    expect(sel.tier).toBe("exact-model");
    expect(sel.isFallback).toBe(false);
    expect(sel.pattern.model).toContain("9166");
  });

  it("flags a fallback (with warning) when no model pattern exists", () => {
    const product = getProduct("cat9105")!; // not registered in the library
    const sel = selectPattern({
      product,
      band: "5",
      antenna: "integrated",
      mountingMode: "ceiling",
      orientation: "horizontal",
    });
    expect(sel.isFallback).toBe(true);
    expect(sel.warning).toContain("fallback");
    expect(sel.fallbackReason).toBeTruthy();
  });

  it("never silently uses a generic pattern — fallback is always labeled", () => {
    const gen = genericSelection("6", true);
    expect(gen.tier).toBe("generic-fallback");
    expect(gen.isFallback).toBe(true);
    expect(gen.warning).toContain("fallback");
  });

  it("directional model resolves a directional (sector) pattern, not omni", () => {
    const product = getProduct("cat9124")!; // outdoor directional, registered external
    const sel = selectPattern({
      product,
      band: "5",
      antenna: "external",
      mountingMode: "outdoor",
      orientation: "horizontal",
    });
    expect(sel.pattern.antenna.type).toBe("sector");
  });
});
