import {
  isIsoDate,
  RATE_ITEM_TYPES,
  rateItemTypeLabel,
  rupeesToMinor,
  type BookingMilestoneType,
  type HotelRateItemType,
  type ServiceFeeStructure,
} from "@ampm/core";

import { milestoneTypeLabel } from "../consultancy/consultancy.format";

/**
 * Shared parsing, validation and option lists for the staff create forms (Slice 3). The forms are plain
 * controlled text inputs because the UI library has no Select/Date primitive (ui.md): enums are picked
 * with the kit's FilterChip and SegmentedControl, amounts are typed as rupees that convert to the wire's
 * integer paise, and each field check returns the gold error line that names its field (Peacock Night
 * §5: "inline gold helper text that names the field").
 */

/**
 * The shared, framework-free money + date parsing (code.md reuse; defined in `@ampm/core`): rupees <->
 * wire paise and the YYYY-MM-DD check both audiences' forms use. Re-exported so this module stays the
 * staff forms' single import for parsing, option lists and field checks.
 */
export { isIsoDate, rupeesToMinor };
export { isoDateTimeFromDate, moneyFromRupees } from "@ampm/core";

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

/** A proposal line's kind as staff read it ("Room rate"); the label + order are shared from @ampm/core. */
export { rateItemTypeLabel as rateItemLabel };

/** The line-item kinds on a proposal line (the hotel_rate_items enum, data-model §6). */
export const RATE_ITEM_OPTIONS: ReadonlyArray<ChoiceOption<HotelRateItemType>> =
  RATE_ITEM_TYPES.map((value) => ({ value, label: rateItemTypeLabel(value) }));

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
