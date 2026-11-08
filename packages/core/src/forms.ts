import type { Money } from "./schemas/common.js";

/*
 * Pure parsing shared by the staff create/edit forms, framework-free so every feature and app uses one
 * copy (code.md reuse): rupees text <-> wire paise with NO floating point on the money path (data.md),
 * and the YYYY-MM-DD date check the forms use while the UI has no date-picker primitive (ui.md). The
 * user-facing error copy stays in the features that render it.
 */

/**
 * A rupees string ("12,50,000" or "1250000.50") as whole paise, combining the rupees and the up-to-two
 * paise digits as integers (no floating point). Null unless the text is a non-negative amount with at
 * most two decimal places.
 */
export function rupeesToMinor(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** A `Money` wire object from a rupees string, or null when the text is not a valid amount. */
export function moneyFromRupees(text: string): Money | null {
  const minor = rupeesToMinor(text);
  return minor === null ? null : { minor, currency: "INR" };
}

/** Whole paise back to the rupees text a form edits ("1250000.50"), the inverse of `rupeesToMinor`. */
export function rupeesFromMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const paise = abs % 100;
  const rupees = (abs - paise) / 100;
  return paise === 0 ? `${sign}${rupees}` : `${sign}${rupees}.${String(paise).padStart(2, "0")}`;
}

/** A real YYYY-MM-DD calendar date, matching the server's `z.iso.date()` (rejects e.g. 2027-02-30). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A YYYY-MM-DD date as an ISO datetime at midnight UTC, for a `z.iso.datetime()` field. */
export function isoDateTimeFromDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}
