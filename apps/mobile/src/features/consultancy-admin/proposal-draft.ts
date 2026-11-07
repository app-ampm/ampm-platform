import type {
  HotelProposalCreateRequest,
  HotelProposalLineInput,
  HotelRateItemType,
} from "@ampm/core";

import { isIsoDate, moneyFromRupees, rupeesToMinor } from "./consultancy-admin.form";

/**
 * The proposal form's state as text, and its parsing to the create request (pure, so it is tested
 * without rendering). Both totals are typed (A-4); the margin is derived server-side, never here.
 */

/** The proposal's own fields as typed. */
export interface TotalsDraft {
  readonly clientTotal: string;
  readonly internalTotal: string;
  readonly validUntil: string;
}

export const EMPTY_TOTALS: TotalsDraft = { clientTotal: "", internalTotal: "", validUntil: "" };

/** One line of the proposal as the form holds it: all text until it is parsed on submit. */
export interface LineDraft {
  /** Stable for the life of the form, so a row keeps its own field state when an earlier one goes. */
  readonly key: number;
  readonly itemType: HotelRateItemType | null;
  readonly description: string;
  readonly quantity: string;
  readonly unitAmount: string;
  readonly totalAmount: string;
  // null until the staff member explicitly chooses: a line must not be submittable with an
  // unconsidered visibility (fail closed, security.md) — the client view carries client-visible lines.
  readonly clientVisible: boolean | null;
}

/** The editable part of a line: everything but its key. */
export type LinePatch = Partial<Omit<LineDraft, "key">>;

export function emptyLine(key: number): LineDraft {
  return {
    key,
    itemType: null,
    description: "",
    quantity: "",
    unitAmount: "",
    totalAmount: "",
    clientVisible: null,
  };
}

/** A positive quantity ("60", "1,200", "2.5"), or null. */
function parseQuantity(text: string): number | null {
  const quantity = Number(text.replace(/[,\s]/g, ""));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

/** Parse a line draft to the wire input, or null when any field is missing or out of range. */
export function lineToInput(draft: LineDraft): HotelProposalLineInput | null {
  const description = draft.description.trim();
  const quantity = parseQuantity(draft.quantity);
  const unitAmount = moneyFromRupees(draft.unitAmount);
  const totalAmount = moneyFromRupees(draft.totalAmount);
  if (draft.itemType === null || description.length === 0 || draft.clientVisible === null)
    return null;
  if (quantity === null || !unitAmount || !totalAmount) return null;
  return {
    itemType: draft.itemType,
    description,
    quantity,
    unitAmount,
    totalAmount,
    clientVisible: draft.clientVisible,
  };
}

/**
 * The create request when every field parses, else null (the submit stays disabled): both totals, an
 * optional real calendar date, and each line complete with its visibility chosen.
 */
export function proposalRequest(
  enquiryId: string,
  totals: TotalsDraft,
  lines: readonly LineDraft[],
): HotelProposalCreateRequest | null {
  const clientTotal = moneyFromRupees(totals.clientTotal);
  const internalTotal = moneyFromRupees(totals.internalTotal);
  const validUntil = totals.validUntil.trim();
  if (clientTotal === null || internalTotal === null) return null;
  if (validUntil !== "" && !isIsoDate(validUntil)) return null;
  const parsed = lines.map(lineToInput);
  const complete = parsed.filter((line): line is HotelProposalLineInput => line !== null);
  if (complete.length !== parsed.length) return null;
  return {
    enquiryId,
    validUntil: validUntil === "" ? null : validUntil,
    clientTotal,
    internalTotal,
    lines: complete,
  };
}

/** The quantity's error line: required, and a number above zero. */
export function quantityError(text: string): string | undefined {
  if (text.trim() === "") return "Enter the quantity";
  return parseQuantity(text) === null ? "Enter a quantity above zero" : undefined;
}

/**
 * What the lines the client will see add up to, in paise: null until there is at least one such line
 * and every one of them has a total that parses, so a half-typed line never shows a misleading sum.
 */
export function clientLinesTotalMinor(lines: readonly LineDraft[]): number | null {
  const totals = lines
    .filter((line) => line.clientVisible === true)
    .map((line) => rupeesToMinor(line.totalAmount.trim()));
  if (totals.length === 0) return null;
  let sum = 0;
  for (const total of totals) {
    if (total === null) return null;
    sum += total;
  }
  return Number.isSafeInteger(sum) ? sum : null;
}
