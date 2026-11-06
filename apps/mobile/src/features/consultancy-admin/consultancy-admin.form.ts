import type { BookingMilestoneType, HotelRateItemType, Money } from "@ampm/core";

import { milestoneTypeLabel } from "../consultancy/consultancy.format";

/**
 * Shared parsing, validation and option lists for the staff create forms (Slice 3). The forms are plain
 * controlled text inputs because the UI library has no Select/Date primitive (ui.md); enums are entered
 * through button rows (OptionButtons) and amounts as rupees that convert to the wire's integer paise.
 */

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

/** Parse a rupees string ("12,50,000" or "1250000.50") to whole paise with NO floating-point on the money
 *  path (data.md): the rupees and the up-to-two-digit paise are combined as integers. Null unless the text
 *  is a non-negative amount with at most two decimal places. */
export function rupeesToMinor(text: string): number | null {
  const cleaned = text.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** A money object for a request body from a rupees string, or null when the text is not a valid amount. */
export function moneyFromRupees(text: string): Money | null {
  const minor = rupeesToMinor(text);
  return minor === null ? null : { minor, currency: "INR" };
}

/** A denied (403) or guard-blocked (409) write carries a useful message; surface it over the fallback. */
export function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

/** The milestone kinds a staff member can create (labels reused from the client format map). */
export const MILESTONE_TYPE_OPTIONS: ReadonlyArray<{
  readonly value: BookingMilestoneType;
  readonly label: string;
}> = (
  [
    "hold_placed",
    "contract_sent",
    "contract_signed",
    "advance_paid",
    "rooming_list_due",
    "balance_due",
    "confirmed",
  ] as const
).map((value) => ({ value, label: milestoneTypeLabel(value) }));

/** The line-item kinds on a proposal line (the hotel_rate_items enum, data-model §6). */
export const RATE_ITEM_OPTIONS: ReadonlyArray<{
  readonly value: HotelRateItemType;
  readonly label: string;
}> = [
  { value: "room_rate", label: "Room rate" },
  { value: "venue_rental", label: "Venue rental" },
  { value: "per_plate_veg", label: "Per plate (veg)" },
  { value: "per_plate_non_veg", label: "Per plate (non-veg)" },
  { value: "wedding_package", label: "Wedding package" },
  { value: "beverage_package", label: "Beverage package" },
  { value: "service_charge", label: "Service charge" },
  { value: "tax", label: "Tax" },
  { value: "other", label: "Other" },
];
