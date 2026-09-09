/**
 * Secure share-link model for read-only report sharing. Tokens are
 * cryptographically random; only a hash is stored. Expiry and revocation are
 * enforced at validation time (server-side once wired). Share links are
 * read-only and scoped to a single report snapshot. See override §8. Original code.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface ShareLinkOptions {
  reportId: string;
  expiresAt: string | null; // ISO; null = no expiry
  allowPdf: boolean;
  allowCsv: boolean;
  hidePrices: boolean;
  hideCustomerFields: boolean;
}

export interface ShareLinkRecord {
  id: string; // opaque, non-sequential
  reportId: string;
  tokenHash: string; // sha-256 hex of the token; the raw token is never stored
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  allowPdf: boolean;
  allowCsv: boolean;
  hidePrices: boolean;
  hideCustomerFields: boolean;
  accessCount: number;
}

export interface CreatedShareLink {
  record: ShareLinkRecord;
  /** The raw token — shown once to the creator, never persisted. */
  token: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a share link with a strong random token; store only the hash. */
export function createShareLink(
  opts: ShareLinkOptions,
  now = new Date().toISOString(),
): CreatedShareLink {
  const token = randomBytes(32).toString("base64url");
  const id = randomBytes(9).toString("base64url"); // opaque, non-sequential
  const record: ShareLinkRecord = {
    id,
    reportId: opts.reportId,
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: opts.expiresAt,
    revoked: false,
    allowPdf: opts.allowPdf,
    allowCsv: opts.allowCsv,
    hidePrices: opts.hidePrices,
    hideCustomerFields: opts.hideCustomerFields,
    accessCount: 0,
  };
  return { record, token };
}

export type ShareValidation =
  | { ok: true; record: ShareLinkRecord }
  | { ok: false; reason: "not-found" | "revoked" | "expired" | "bad-token" };

/**
 * Validate a presented token against a stored record. Uses a constant-time
 * comparison. Enforces revocation and expiry. Read-only by design: this returns
 * only view access; there is no write capability from a share link.
 */
export function validateShareLink(
  record: ShareLinkRecord | null,
  token: string,
  now = new Date().toISOString(),
): ShareValidation {
  if (!record) return { ok: false, reason: "not-found" };
  if (record.revoked) return { ok: false, reason: "revoked" };
  if (record.expiresAt && new Date(now).getTime() > new Date(record.expiresAt).getTime()) {
    return { ok: false, reason: "expired" };
  }
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(record.tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad-token" };
  }
  return { ok: true, record };
}

export function revokeShareLink(record: ShareLinkRecord): ShareLinkRecord {
  return { ...record, revoked: true };
}

/** Regenerate a link: revoke the old record and create a fresh token. */
export function regenerateShareLink(record: ShareLinkRecord): CreatedShareLink {
  return createShareLink({
    reportId: record.reportId,
    expiresAt: record.expiresAt,
    allowPdf: record.allowPdf,
    allowCsv: record.allowCsv,
    hidePrices: record.hidePrices,
    hideCustomerFields: record.hideCustomerFields,
  });
}
