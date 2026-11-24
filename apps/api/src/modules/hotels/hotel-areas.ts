import { areaWrite, type HotelAreaPair } from "@ampm/core";

/*
 * The units write rule (D-178; core `areaWrite`) on each area pair a record carries: a room's size, a
 * venue's area and pre-function area, a hotel's total event space. One helper for the staff writes and the
 * import rows alike, so a filled sq ft always stores its derived m², an m² written alone on a row that
 * stores sq ft clears that sq ft, and a sq ft cleared alone leaves the stored m². Pure.
 */

/** An area figure as a write gives it: a number, null to clear it, or undefined to leave it. */
const areaValue = (value: unknown): number | null | undefined =>
  typeof value === "number" || value === null ? value : undefined;

const storedSqft = (value: unknown): number | null => (typeof value === "number" ? value : null);

/**
 * The fields as written once the units rule has run on each of the record's area pairs, read against
 * what the row stores now (null on a create). A pair the fields leave out is left out.
 *
 * @example
 * settleAreas({ name: "Synthetic Suite", sizeSqft: 1_000 }, ROOM_AREA_PAIRS, null);
 * // { name: "Synthetic Suite", sizeSqft: 1000, sizeSqm: 93 }
 * settleAreas({ sizeSqm: 80 }, ROOM_AREA_PAIRS, { sizeSqft: 1_000 }); // { sizeSqm: 80, sizeSqft: null }
 */
export function settleAreas<K extends string, T extends Readonly<Partial<Record<K, unknown>>>>(
  fields: T,
  pairs: readonly HotelAreaPair<K>[],
  stored: Readonly<Partial<Record<NoInfer<K>, unknown>>> | null,
): T {
  let settled: T = fields;
  for (const pair of pairs) {
    const area = areaWrite(
      { sqm: areaValue(settled[pair.sqm]), sqft: areaValue(settled[pair.sqft]) },
      storedSqft(stored?.[pair.sqft]),
    );
    if (area.sqm !== undefined) settled = { ...settled, [pair.sqm]: area.sqm };
    if (area.sqft !== undefined) settled = { ...settled, [pair.sqft]: area.sqft };
  }
  return settled;
}
