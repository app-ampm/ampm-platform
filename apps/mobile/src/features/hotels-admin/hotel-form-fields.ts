import { hotelListEntries } from "@ampm/core";

/*
 * Shared pure helpers for the hotel-admin forms (profile, rooms, venues, contacts): the editors hold
 * text as strings and parse on submit, so these convert between the view's typed fields and the draft's
 * strings, and build the request values (trimmed text or null, parsed numbers, the rooms' and venues'
 * comma-separated facility lists, the profile's one-per-line lists, a yes / no / not known answer). No
 * rendering, no I/O — tested through the form modules that use them and in hotel-form-fields.test.ts.
 */

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

/** A facility list as the "wifi, pool, spa" text the form shows. */
export function facilitiesToText(facilities: readonly string[] | null): string {
  return facilities ? facilities.join(", ") : "";
}

/** Split the "wifi, pool, spa" text into the trimmed, non-empty facility array the API takes (null if none). */
export function textToFacilities(value: string): string[] | null {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length === 0 ? null : items;
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
