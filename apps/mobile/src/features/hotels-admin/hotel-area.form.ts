import { sqmFromSqft } from "@ampm/core";

import { numberOrNull, numberRuleError, type NumberRule } from "./hotel-form-fields";

/*
 * One area as the editors hold it, in m² and sq ft (D-178; the units rule of core `areaWrite`): a room's
 * size, a venue's area and pre-function area, a hotel's total event space. While the sq ft box holds
 * anything, the m² is worked out from it with core's converter, shown read-only and sent with it, so the
 * editor shows the figure the server stores; with the sq ft empty, the m² is typed. Pure, so the four
 * areas follow one rule and it is tested without rendering.
 */

/** What an area's two boxes accept. */
export interface AreaRules {
  readonly sqm: NumberRule;
  readonly sqft: NumberRule;
}

/** The hint under an m² box worked out from the sq ft. */
export const DERIVED_SQM_HINT = "Worked out from sq ft";

function wholeArea(max: number, message: string): NumberRule {
  return { min: 0, max, places: 0, message };
}

/** A room category's size (`sizeSqm` / `sizeSqft`). */
export const ROOM_SIZE_AREA: AreaRules = {
  sqm: wholeArea(100_000, "Size in m² is a whole number, up to 100,000"),
  sqft: wholeArea(1_000_000, "Size in sq ft is a whole number, up to 1,000,000"),
};

/** A venue's floor area (`areaSqm` / `areaSqft`). */
export const VENUE_AREA: AreaRules = {
  sqm: wholeArea(1_000_000, "Area in m² is a whole number, up to 1,000,000"),
  sqft: wholeArea(10_000_000, "Area in sq ft is a whole number, up to 10,000,000"),
};

/** A venue's pre-function area (`prefunctionAreaSqm` / `prefunctionAreaSqft`). */
export const PREFUNCTION_AREA: AreaRules = {
  sqm: wholeArea(1_000_000, "Pre-function area in m² is a whole number, up to 1,000,000"),
  sqft: wholeArea(10_000_000, "Pre-function area in sq ft is a whole number, up to 10,000,000"),
};

/** A hotel's total event space (`totalEventSpaceSqm` / `totalEventSpaceSqft`). */
export const EVENT_SPACE_AREA: AreaRules = {
  sqm: wholeArea(1_000_000, "Event space in m² is a whole number, up to 1,000,000"),
  sqft: wholeArea(10_000_000, "Event space in sq ft is a whole number, up to 10,000,000"),
};

/** Whether the m² is worked out from the sq ft: it is while the sq ft box holds anything. */
export function isSqmDerived(sqft: string): boolean {
  return sqft.trim() !== "";
}

/**
 * What the m² box shows: the m² worked out from a valid sq ft, blank while the sq ft is not one yet, or
 * the m² typed when there is no sq ft (kept while the sq ft is filled, so emptying it brings it back).
 *
 * @example
 * shownSqm("", "1000", VENUE_AREA); // "93"
 * shownSqm("80", "", VENUE_AREA); // "80"
 */
export function shownSqm(sqm: string, sqft: string, rules: AreaRules): string {
  if (!isSqmDerived(sqft)) return sqm;
  return numberRuleError(sqft, rules.sqft) ? "" : String(sqmFromSqft(Number(sqft.trim())));
}

/** The errors of an area's two boxes. */
export interface AreaErrors {
  readonly sqm: string | undefined;
  readonly sqft: string | undefined;
}

/**
 * The checks of an area's two boxes: the sq ft always, the m² only while it is typed (a worked-out m² is
 * always in bounds, and an m² typed before the sq ft is not sent).
 *
 * @example
 * areaErrors("12.5", "1000", ROOM_SIZE_AREA); // { sqm: undefined, sqft: undefined }
 */
export function areaErrors(sqm: string, sqft: string, rules: AreaRules): AreaErrors {
  return {
    sqm: isSqmDerived(sqft) ? undefined : numberRuleError(sqm, rules.sqm),
    sqft: numberRuleError(sqft, rules.sqft),
  };
}

/** The area as a request carries it. */
export interface AreaBody {
  readonly sqm: number | null;
  readonly sqft: number | null;
}

/**
 * The area a valid draft sends: a filled sq ft with the m² worked out from it, or the m² typed (or null)
 * with no sq ft, which on a row that stored sq ft makes that m² the published figure.
 *
 * @example
 * areaBody("95", "1000"); // { sqm: 93, sqft: 1000 }
 * areaBody("80", ""); // { sqm: 80, sqft: null }
 */
export function areaBody(sqm: string, sqft: string): AreaBody {
  const feet = numberOrNull(sqft);
  return feet === null
    ? { sqm: numberOrNull(sqm), sqft: null }
    : { sqm: sqmFromSqft(feet), sqft: feet };
}
