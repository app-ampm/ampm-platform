/*
 * Square feet to square metres (D-178; docs/planning/hotel-information-form-plan.md §6.2): one converter
 * for a room's size, a venue's area and pre-function area, and a hotel's total event space, so the API,
 * the imports and the staff editors derive the same figure. Square metres stay canonical for filters; a
 * hotel's published square feet are kept beside them. Integer arithmetic, so the result is exactly
 * PostgreSQL's round(sqft * 145161 / 1562500.0) on a numeric, never the binary double's rounding of
 * sqft * 0.09290304. Areas are never negative, so half up and half away from zero agree.
 */

/** Square metres per square foot, 0.3048² = 0.09290304 exactly, as the fraction 145,161 / 1,562,500. */
export const SQM_PER_SQFT_NUMERATOR = 145_161;

/** The denominator of {@link SQM_PER_SQFT_NUMERATOR}: 381² / 1,250² is 0.3048². */
export const SQM_PER_SQFT_DENOMINATOR = 1_562_500;

/**
 * The whole square metres in an area given in square feet: round(sq ft × 0.09290304), half up. Exact for
 * every area the catalogue takes (sq ft × 145,161 stays far below 2^53, and the division is rounded
 * correctly), including the halves at odd multiples of 781,250 sq ft.
 *
 * @example
 * sqmFromSqft(1_000); // 93 (92.90304)
 * sqmFromSqft(781_250); // 72581 (exactly 72,580.5)
 */
export function sqmFromSqft(sqft: number): number {
  return Math.round((sqft * SQM_PER_SQFT_NUMERATOR) / SQM_PER_SQFT_DENOMINATOR);
}

/** One area as a write sets it: a figure left undefined is not written, and null clears it. */
export interface AreaWrite {
  readonly sqm?: number | null | undefined;
  readonly sqft?: number | null | undefined;
}

/**
 * The fields of one area: its square metres and its square feet (`sizeSqm`/`sizeSqft` on a room,
 * `areaSqm`/`areaSqft` and `prefunctionAreaSqm`/`prefunctionAreaSqft` on a venue,
 * `totalEventSpaceSqm`/`totalEventSpaceSqft` on a hotel).
 */
export interface HotelAreaPair<K extends string = string> {
  readonly sqm: K;
  readonly sqft: K;
}

/**
 * The units write rule (D-178), one for staff writes and import rows alike, applied before the write:
 * - a write that sets sq ft to a number stores it with the m² derived from it; an m² sent with it is
 *   replaced by the derived figure;
 * - a write that sets m² (a number, or null) without sq ft, on a row that stores sq ft, makes that m² the
 *   published figure and clears the sq ft, so the two never disagree (an import names both changed);
 * - a write that clears sq ft (null) leaves the stored m², unless it sets the m² too.
 * `storedSqft` is the row's sq ft before the write: null on a create or when it has none.
 *
 * @example
 * areaWrite({ sqft: 1_000, sqm: 95 }, null); // { sqm: 93, sqft: 1000 }
 * areaWrite({ sqm: 80 }, 1_000); // { sqm: 80, sqft: null }
 * areaWrite({ sqft: null }, 1_000); // { sqft: null }: the stored m² stays
 */
export function areaWrite(write: AreaWrite, storedSqft: number | null): AreaWrite {
  const { sqm, sqft } = write;
  if (typeof sqft === "number") return { sqm: sqmFromSqft(sqft), sqft };
  if (sqft === null) return sqm === undefined ? { sqft: null } : { sqm, sqft: null };
  if (sqm === undefined) return {};
  return storedSqft === null ? { sqm } : { sqm, sqft: null };
}

/**
 * Whether a number has at most `places` decimal places, as a numeric(p, places) column keeps it without
 * rounding (a distance to one place, a length in metres to two). Tolerant of the binary double's error,
 * so 0.1 + 0.2 counts as 0.30.
 *
 * @example
 * hasAtMostDecimals(12.75, 2); // true
 * hasAtMostDecimals(12.755, 2); // false
 */
export function hasAtMostDecimals(value: number, places: number): boolean {
  const scaled = value * 10 ** places;
  return Math.abs(Math.round(scaled) - scaled) < 1e-6;
}
