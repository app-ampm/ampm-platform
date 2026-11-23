import type { VenueOtherLayout } from "./hotel-rooms-venues.js";

/*
 * How the staff import reads a cell, for every kind (TW-25; D-178, D-181): list cells, enum cells, a
 * venue's other layouts and its capacities. Pure, so the API's CSV reader and the template help in the
 * staff app say the same thing. Each helper reads one non-blank cell; the row schemas then check bounds.
 */

/** What separates the entries of a list cell (name variants, facilities, cuisines, other layouts). */
export const HOTEL_IMPORT_LIST_SEPARATOR = "|";

/**
 * The entries of a list written as text: split at each {@link HOTEL_IMPORT_LIST_SEPARATOR} and each line
 * break, trimmed, blank ones dropped. One rule for an import's list cell and the staff editor's
 * one-per-line lists, so a list either of them saves reads back the same through the other (an entry
 * never holds a "|" or a line break).
 *
 * @example
 * hotelListEntries("Pool | Spa, salon and gym\nValet parking"); // ["Pool", "Spa, salon and gym", "Valet parking"]
 */
export function hotelListEntries(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line) => line.split(HOTEL_IMPORT_LIST_SEPARATOR))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

/**
 * An enum cell as the value it names (D-181): any case, each run of spaces and hyphens read as one
 * underscore. The row schema then checks the value against its enum.
 *
 * @example
 * hotelImportEnumValue("Meeting room"); // "meeting_room"
 * hotelImportEnumValue("Tent-suite"); // "tent_suite"
 */
export function hotelImportEnumValue(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Why an other-layouts cell is refused, on the `otherLayouts` field. */
export const VENUE_LAYOUTS_CELL_MESSAGE =
  "Write each layout as Name: max or Name: min-max, for example Classroom: 120 | U-shape: 30-40";

/** A layout's guests: one whole number, or a range written min-max (a hyphen or an en dash). */
const LAYOUT_GUESTS = /^(\d+)(?:\s*[-–]\s*(\d+))?$/;

/** One `Name: max` or `Name: min-max` entry, split at its last colon; null when it does not read. */
function layoutEntry(entry: string): VenueOtherLayout | null {
  const colon = entry.lastIndexOf(":");
  const layout = entry.slice(0, Math.max(colon, 0)).trim();
  const guests = LAYOUT_GUESTS.exec(entry.slice(colon + 1).trim());
  if (colon === -1 || layout === "" || guests === null) return null;
  const [, first = "", second] = guests;
  return second === undefined
    ? { layout, max: Number(first) }
    : { layout, min: Number(first), max: Number(second) };
}

/**
 * A venue's other-layouts cell as its entries (D-178): entries split as any list cell is
 * ({@link hotelListEntries}), each `Name: max` or `Name: min-max`. Null when any entry does not read,
 * which the reader reports with {@link VENUE_LAYOUTS_CELL_MESSAGE}; the row schema then checks the
 * names, the numbers and the count. An empty cell gives no entries.
 *
 * @example
 * parseVenueLayoutsCell("Classroom: 120 | U-shape: 30-40");
 * // [{ layout: "Classroom", max: 120 }, { layout: "U-shape", min: 30, max: 40 }]
 * parseVenueLayoutsCell("Classroom 120"); // null
 */
export function parseVenueLayoutsCell(text: string): VenueOtherLayout[] | null {
  const layouts: VenueOtherLayout[] = [];
  for (const entry of hotelListEntries(text)) {
    const layout = layoutEntry(entry);
    if (layout === null) return null;
    layouts.push(layout);
  }
  return layouts;
}

/** Why a capacity cell holding a range is refused: a capacity column takes the maximum alone. */
export const VENUE_CAPACITY_RANGE_MESSAGE = "Use one number; put the range in capacityNotes";

const NUMBER_RANGE = /^\d[\d,]*\s*(?:[-–]|to)\s*\d[\d,]*$/i;

/**
 * Whether a number cell holds a range ("600-700", "600 to 700"), which a capacity cell refuses with
 * {@link VENUE_CAPACITY_RANGE_MESSAGE} rather than the plain "not a number".
 *
 * @example
 * isNumberRangeCell("600-700"); // true
 * isNumberRangeCell("650"); // false
 */
export function isNumberRangeCell(text: string): boolean {
  return NUMBER_RANGE.test(text.trim());
}
