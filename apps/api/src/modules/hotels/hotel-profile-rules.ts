import { HOTEL_CUISINE_OTHER, normalisePostalCode, postalCodeProblem } from "@ampm/core";

/*
 * Two profile rules the request schemas cannot hold alone (D-178). A postal code must fit its destination's
 * country: a hotel carries no country of its own, and India's PIN rule applies only there, to a new code
 * and to the one a hotel keeps when it moves to another destination. A cuisine label
 * must be one the configuration `hotel.cuisine_options` offers, "Other", or one the hotel already carries.
 * Pure, so the staff writes and the import planner apply one rule.
 */

/** The country of a destination an import creates on the way (destinations default to India). */
export const NEW_DESTINATION_COUNTRY = "India";

/** Why a cuisine label was refused. */
export const CUISINE_REFUSED = `Choose a cuisine from the list, or ${HOTEL_CUISINE_OTHER}`;

/** Why a move to another destination is refused when the postal code the hotel keeps breaks its rule. */
export const KEPT_POSTAL_CODE_REFUSED =
  "The hotel's postal code does not fit the new destination's country; give its postal code too";

/**
 * The cuisine labels a hotel may carry: the configured options and "Other", plus any it already has, so a
 * label AMPM later drops from the list never blocks an unrelated edit. A configured spelling wins over an
 * old one that differs only in case.
 *
 * @example
 * allowedCuisines(["Indian", "Italian"], ["Goan"]); // ["Goan", "Indian", "Italian", "Other"]
 */
export function allowedCuisines(
  options: readonly string[],
  existing: readonly string[] | null,
): readonly string[] {
  return [...(existing ?? []), ...options, HOTEL_CUISINE_OTHER];
}

/**
 * The labels as stored, each matched to its allowed spelling ignoring case ("indian" becomes "Indian"),
 * and the indexes of the labels no allowed one matches.
 *
 * @example
 * resolveCuisines(["indian", "Thai"], ["Indian", "Other"]); // { labels: ["Indian", "Thai"], unknown: [1] }
 */
export function resolveCuisines(
  labels: readonly string[],
  allowed: readonly string[],
): { readonly labels: string[]; readonly unknown: number[] } {
  const spelling = new Map(allowed.map((label) => [label.trim().toLowerCase(), label]));
  const unknown: number[] = [];
  const resolved = labels.map((label, index) => {
    const match = spelling.get(label.trim().toLowerCase());
    if (match === undefined) unknown.push(index);
    return match ?? label;
  });
  return { labels: resolved, unknown };
}

/**
 * A postal code as stored (the spaces people type inside a PIN removed), and why it does not fit the
 * destination's country, or null when it fits.
 *
 * @example
 * checkPostalCode("313 001", "India"); // { postalCode: "313001", problem: null }
 */
export function checkPostalCode(
  code: string,
  country: string | null,
): { readonly postalCode: string; readonly problem: string | null } {
  const postalCode = normalisePostalCode(code);
  return { postalCode, problem: postalCodeProblem(country, postalCode) };
}

/**
 * Why a hotel that moves to a destination in `country` without a new postal code cannot keep its stored
 * one, or null when it may (none stored, or it fits). A move is checked like a new code, so a hotel
 * never lands in India with a code that breaks the PIN rule.
 *
 * @example
 * keptPostalCodeProblem("SW1A 1AA", "India"); // KEPT_POSTAL_CODE_REFUSED
 */
export function keptPostalCodeProblem(
  stored: string | null,
  country: string | null,
): string | null {
  if (stored === null) return null;
  return postalCodeProblem(country, stored) === null ? null : KEPT_POSTAL_CODE_REFUSED;
}
