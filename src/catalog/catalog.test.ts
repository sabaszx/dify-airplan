import { describe, it, expect } from "vitest";
import { loadCatalog, getProduct, productsByGeneration } from "./index";

describe("Cisco AP catalog", () => {
  it("validates against the schema and loads all seeded products", () => {
    const catalog = loadCatalog();
    expect(catalog.products.length).toBeGreaterThanOrEqual(16);
  });

  it("flags every seeded product as unverified sample data", () => {
    const catalog = loadCatalog();
    for (const p of catalog.products) {
      expect(p.verified).toBe(false);
      expect(p.lastVerified).toBeNull();
    }
  });

  it("groups products by Wi-Fi generation", () => {
    const groups = productsByGeneration();
    expect(groups["Wi-Fi 6"]?.length).toBeGreaterThan(0);
    expect(groups["Wi-Fi 6E"]?.length).toBeGreaterThan(0);
    expect(groups["Wi-Fi 7"]?.length).toBeGreaterThan(0);
  });

  it("6E and 7 models include a 6 GHz radio", () => {
    const p = getProduct("cat9166");
    expect(p?.supportedBands).toContain("6");
  });
});
