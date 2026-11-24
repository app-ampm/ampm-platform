import { createHash, randomBytes } from "node:crypto";

/*
 * A hotel information request's link (D-188 §4): `hfl_` and the base64url of 32 random bytes, stored
 * only as its SHA-256. The URL carries it in the fragment (`#k=`), which no browser sends to a server, so
 * it stays out of AMPM's web server logs, request URLs and Referer headers. The link is answered only by
 * the create and reissue routes and rides only in a queued email's render data, which is cleared once the
 * email leaves the queue; it is never logged, audited or written to an event.
 */

/** A link secret's prefix, which the secret scanners and the log redactor know (D-188 §6). */
export const HOTEL_FORM_LINK_PREFIX = "hfl_";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A new link's secret, and the hash that alone is stored. */
export interface LinkSecret {
  readonly secret: string;
  readonly hash: string;
}

/**
 * The SHA-256 of a link's secret, hex: what `hotel_info_requests.token_hash` holds. A random 32-byte
 * secret is looked up by a fast hash, as the sign-in tokens are; Slice 7b compares in constant time.
 *
 * @example
 * hashLinkSecret("hfl_…"); // 64 hex characters
 */
export function hashLinkSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Mints a link's secret.
 *
 * @example
 * const { secret, hash } = mintLinkSecret(); // store `hash`; answer the link built from `secret` once
 */
export function mintLinkSecret(): LinkSecret {
  const secret = `${HOTEL_FORM_LINK_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { secret, hash: hashLinkSecret(secret) };
}

/**
 * The link a hotel opens: `<PUBLIC_SITE_URL>/hotel-form#k=<secret>`.
 *
 * @example
 * hotelFormLinkUrl("https://site.ampmverse.com", secret); // "https://site.ampmverse.com/hotel-form#k=hfl_…"
 */
export function hotelFormLinkUrl(siteUrl: string, secret: string): string {
  return `${siteUrl}/hotel-form#k=${secret}`;
}

/** A time some whole days later. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

const IST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * A link's expiry as the email states it: the date and time in India, where AMPM's hotels are, with the
 * zone named so a hotel elsewhere can tell.
 *
 * @example
 * expiryForEmail(new Date("2026-12-24T10:00:00Z")); // "24 December 2026, 15:30 IST"
 */
export function expiryForEmail(expiresAt: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    IST.formatToParts(expiresAt).find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} IST`;
}
