import type {
  BookingMilestoneType,
  HotelRateItemType,
  Money,
  ServiceFeeStructure,
} from "@ampm/core";

import { milestoneTypeLabel } from "../consultancy/consultancy.format";
import { isIsoDate } from "../consultancy/new-request.form";

/**
 * Shared parsing, validation and option lists for the staff create forms (Slice 3). The forms are plain
 * controlled text inputs because the UI library has no Select/Date primitive (ui.md): enums are picked
 * with the kit's FilterChip and SegmentedControl, amounts are typed as rupees that convert to the wire's
 * integer paise, and each field check returns the gold error line that names its field (Peacock Night
 * §5: "inline gold helper text that names the field").
 */

/** The client request form's calendar-date check, the one copy both audiences' forms use. */
export { isIsoDate };

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
  const message =
    typeof error === "object" && error !== null && "message" in error ? error.message : undefined;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

// --- Field checks: undefined when the text is acceptable, else the error line that names the field ---

/** Rupees: "Enter the fee" when a required one is empty, a format hint when it will not parse. */
export function amountError(text: string, field: string, required: boolean): string | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return required ? `Enter the ${field}` : undefined;
  return rupeesToMinor(trimmed) === null
    ? `Enter the ${field} in rupees, such as 25000`
    : undefined;
}

/** A calendar date typed as YYYY-MM-DD (the forms have no date picker yet). */
export function dateError(text: string, field: string, required: boolean): string | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return required ? `Enter the ${field}` : undefined;
  return isIsoDate(trimmed) ? undefined : `Enter the ${field} as YYYY-MM-DD`;
}

/** Free text that must not be blank. */
export function textError(text: string, message: string): string | undefined {
  return text.trim().length > 0 ? undefined : message;
}

// --- Choices -----------------------------------------------------------------------------------------

/** One choice in a chip or segment picker: the wire value and its label. */
export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** The milestone kinds a staff member can create (labels reused from the client format map). */
export const MILESTONE_TYPE_OPTIONS: ReadonlyArray<ChoiceOption<BookingMilestoneType>> = (
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

const RATE_ITEM_LABEL: Record<HotelRateItemType, string> = {
  room_rate: "Room rate",
  venue_rental: "Venue rental",
  per_plate_veg: "Per plate (veg)",
  per_plate_non_veg: "Per plate (non-veg)",
  wedding_package: "Wedding package",
  beverage_package: "Beverage package",
  service_charge: "Service charge",
  tax: "Tax",
  other: "Other",
};

/** The line-item kinds on a proposal line (the hotel_rate_items enum, data-model §6). */
export const RATE_ITEM_OPTIONS: ReadonlyArray<ChoiceOption<HotelRateItemType>> = (
  [
    "room_rate",
    "venue_rental",
    "per_plate_veg",
    "per_plate_non_veg",
    "wedding_package",
    "beverage_package",
    "service_charge",
    "tax",
    "other",
  ] as const
).map((value) => ({ value, label: RATE_ITEM_LABEL[value] }));

/** A proposal line's kind as staff read it ("Room rate"). */
export function rateItemLabel(type: HotelRateItemType): string {
  return RATE_ITEM_LABEL[type];
}

const FEE_STRUCTURE_LABEL: Record<ServiceFeeStructure, string> = {
  fixed: "Fixed",
  percentage: "Percentage",
  milestones: "Milestones",
};

/** How a service agreement's fee is charged. */
export const FEE_STRUCTURE_OPTIONS: ReadonlyArray<ChoiceOption<ServiceFeeStructure>> = (
  ["fixed", "percentage", "milestones"] as const
).map((value) => ({ value, label: FEE_STRUCTURE_LABEL[value] }));

/** A fee structure as staff read it ("Fixed"). */
export function feeStructureLabel(structure: ServiceFeeStructure): string {
  return FEE_STRUCTURE_LABEL[structure];
}
