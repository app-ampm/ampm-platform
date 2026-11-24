import { FACILITY_LABEL_MAX_LENGTH, FACILITY_LABELS_MAX, hotelListEntries } from "@ampm/core";
import type { ToastOptions } from "@ampm/ui";

/*
 * Shared pure helpers for the hotel-admin forms (profile, rooms, venues, contacts): the editors hold
 * text as strings and parse on submit, so these convert between the view's typed fields and the draft's
 * strings, and build the request values (trimmed text or null, parsed numbers, one-per-line lists read
 * by the import's list rule, a yes / no / not known answer), an update's changed part, and the toast of
 * a save the checks blocked. No rendering, no I/O — tested through the form modules that use them and in
 * hotel-form-fields.test.ts.
 */

/** The longest free text a hotel field takes (an address, a description, notes), as the contract caps it. */
export const LONG_TEXT_MAX = 10_000;

export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** The number typed, or null when blank; call it once the entry has passed its check. */
export function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

export function intOrNull(value: string): number | null {
  return numberOrNull(value);
}

export function numberToText(value: number | null): string {
  return value === null ? "" : String(value);
}

export function isWholeNumber(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/** A non-blank, non-whole-number entry is an error; blank is allowed (the field is optional). */
export function wholeNumberError(value: string, label: string): string | undefined {
  return value.trim() !== "" && !isWholeNumber(value)
    ? `${label} must be a whole number`
    : undefined;
}

/**
 * What a number field accepts: its bounds, how many decimal places (0 for a whole number), and the
 * error that names the field and says what fits, shown for anything else.
 */
export interface NumberRule {
  readonly min: number;
  readonly max: number;
  readonly places: number;
  readonly message: string;
}

/**
 * The rule's message when a non-blank entry is not a plain number (an optional minus, digits, then at
 * most `places` decimals) within its bounds; blank is allowed (the field is optional).
 *
 * @example
 * numberRuleError("12.55", { min: 0, max: 999.9, places: 1, message: "Airport distance …" }); // the message
 */
export function numberRuleError(value: string, rule: NumberRule): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const decimals = rule.places > 0 ? `(\\.\\d{1,${rule.places}})?` : "";
  if (!new RegExp(`^-?\\d+${decimals}$`).test(trimmed)) return rule.message;
  const number = Number(trimmed);
  return number < rule.min || number > rule.max ? rule.message : undefined;
}

/** A list as the one-entry-per-line text a multiline field shows. */
export function listToLines(list: readonly string[] | null): string {
  return list ? list.join("\n") : "";
}

/**
 * The one-per-line text as its trimmed, non-empty entries, or null when there are none. A "|" also
 * separates two, as in an import's list cell: one rule with the import (core `hotelListEntries`), so a
 * list either saves reads back the same through the other, and a save never splits an entry the import
 * wrote (a comma stays inside its entry).
 *
 * @example
 * linesToList("Pool\nSpa, salon and gym | Lawn"); // ["Pool", "Spa, salon and gym", "Lawn"]
 */
export function linesToList(value: string): string[] | null {
  const items = hotelListEntries(value);
  return items.length === 0 ? null : items;
}

/**
 * Why a one-per-line facilities list cannot be saved, or undefined when it can: the contract takes at most
 * 100 entries of at most 120 characters (core `facilityLabels`). A comma stays inside its entry, so a
 * comma list pasted on one line is one long facility, and the message says to put each on its own line.
 *
 * @example
 * facilitiesError("Pool, spa, gym, …"); // over 120 characters: "Each facility is at most 120 characters; …"
 */
export function facilitiesError(value: string): string | undefined {
  const entries = linesToList(value) ?? [];
  if (entries.length > FACILITY_LABELS_MAX) {
    return `Keep to ${FACILITY_LABELS_MAX} facilities, one per line`;
  }
  return entries.some((entry) => entry.length > FACILITY_LABEL_MAX_LENGTH)
    ? `Each facility is at most ${FACILITY_LABEL_MAX_LENGTH} characters; put each one on its own line`
    : undefined;
}

/** A yes / no fact the hotel may not have given yet: "unknown" is null, never false. */
export type TriState = "unknown" | "yes" | "no";

/** The three answers in the order the pickers offer them. */
export const TRI_STATES: readonly TriState[] = ["unknown", "yes", "no"];

export function triStateFrom(value: boolean | null): TriState {
  if (value === null) return "unknown";
  return value ? "yes" : "no";
}

export function booleanFromTriState(state: TriState): boolean | null {
  if (state === "unknown") return null;
  return state === "yes";
}

export function hasErrors(errors: Readonly<Record<string, string | undefined>>): boolean {
  return Object.values(errors).some((error) => error !== undefined);
}

/** Whether two body values are the same: a list or an object by its entries, anything else as it is. */
function sameBodyValue(a: unknown, b: unknown): boolean {
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    // Both bodies come from one builder, so their keys are in the same order.
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

/**
 * The entries of `next` whose value differs from `opened`'s: an update's body, both built from drafts
 * the same way, so formatting never counts as a change and a save never writes back a value it did not
 * touch, which an import or another editor may have changed meanwhile. Empty when nothing changed.
 *
 * @example
 * changedEntries({ name: "Lawn", capacityBanquet: 250 }, { name: "Lawn", capacityBanquet: 200 }); // { capacityBanquet: 250 }
 */
export function changedEntries<T extends object>(next: T, opened: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const key in next) {
    if (!sameBodyValue(next[key], opened[key])) changed[key] = next[key];
  }
  return changed;
}

/**
 * The toast for a save the checks blocked: it names the first field to fix, by its label, and why, since
 * the field may sit in a panel out of sight. The toast carries its own live region.
 *
 * @example
 * blockedSaveToastFor("Max occupancy", "Max occupancy is a whole number from 1 to 100");
 */
export function blockedSaveToastFor(label: string, message: string): ToastOptions {
  return {
    title: "Check the highlighted fields",
    description: `${label}: ${message}`,
    tone: "danger",
  };
}
