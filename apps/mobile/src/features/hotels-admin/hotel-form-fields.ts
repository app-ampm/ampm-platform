/*
 * Shared pure helpers for the hotel-admin forms (profile, rooms, venues, contacts): the editors hold
 * text as strings and parse on submit, so these convert between the view's typed fields and the draft's
 * strings, and build the request values (trimmed text or null, parsed ints, a comma-separated facility
 * list). No rendering, no I/O — tested through the form modules that use them.
 */

export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function intOrNull(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
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

export function hasErrors(errors: Readonly<Record<string, string | undefined>>): boolean {
  return Object.values(errors).some((error) => error !== undefined);
}
