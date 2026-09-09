import { describe, it, expect } from "vitest";
import {
  createShareLink,
  validateShareLink,
  revokeShareLink,
  regenerateShareLink,
  hashToken,
} from "./share-link";

describe("share links (mandatory security)", () => {
  it("stores only a token hash, never the raw token", () => {
    const { record, token } = createShareLink({
      reportId: "RPT-1",
      expiresAt: null,
      allowPdf: true,
      allowCsv: true,
      hidePrices: false,
      hideCustomerFields: false,
    });
    expect(record.tokenHash).toBe(hashToken(token));
    expect(record.tokenHash).not.toBe(token);
    // The id is opaque, not a sequential/project id.
    expect(record.id).not.toContain("RPT-1");
  });

  it("validates a correct token", () => {
    const { record, token } = createShareLink({
      reportId: "RPT-1",
      expiresAt: null,
      allowPdf: true,
      allowCsv: false,
      hidePrices: true,
      hideCustomerFields: false,
    });
    const res = validateShareLink(record, token);
    expect(res.ok).toBe(true);
  });

  it("rejects a wrong token", () => {
    const { record } = createShareLink({
      reportId: "RPT-1",
      expiresAt: null,
      allowPdf: true,
      allowCsv: true,
      hidePrices: false,
      hideCustomerFields: false,
    });
    const res = validateShareLink(record, "not-the-token");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("bad-token");
  });

  it("revoked links cannot be opened (mandatory)", () => {
    const { record, token } = createShareLink({
      reportId: "RPT-1",
      expiresAt: null,
      allowPdf: true,
      allowCsv: true,
      hidePrices: false,
      hideCustomerFields: false,
    });
    const revoked = revokeShareLink(record);
    const res = validateShareLink(revoked, token);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("revoked");
  });

  it("expired links cannot be opened (mandatory)", () => {
    const { record, token } = createShareLink(
      {
        reportId: "RPT-1",
        expiresAt: "2020-01-01T00:00:00Z",
        allowPdf: true,
        allowCsv: true,
        hidePrices: false,
        hideCustomerFields: false,
      },
      "2019-12-01T00:00:00Z",
    );
    const res = validateShareLink(record, token, "2026-01-01T00:00:00Z");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("returns not-found for a missing record", () => {
    const res = validateShareLink(null, "anything");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not-found");
  });

  it("regenerate produces a new token that differs from the old", () => {
    const first = createShareLink({
      reportId: "RPT-1",
      expiresAt: null,
      allowPdf: true,
      allowCsv: true,
      hidePrices: false,
      hideCustomerFields: false,
    });
    const second = regenerateShareLink(first.record);
    expect(second.token).not.toBe(first.token);
    expect(second.record.tokenHash).not.toBe(first.record.tokenHash);
    // Old token no longer validates against the new record.
    expect(validateShareLink(second.record, first.token).ok).toBe(false);
  });

  it("share options carry read-only view flags (no write capability exposed)", () => {
    const { record } = createShareLink({
      reportId: "RPT-1",
      expiresAt: null,
      allowPdf: false,
      allowCsv: false,
      hidePrices: true,
      hideCustomerFields: true,
    });
    // The record has no field granting edit/write access.
    expect(Object.keys(record)).not.toContain("allowEdit");
    expect(record.hidePrices).toBe(true);
  });
});
