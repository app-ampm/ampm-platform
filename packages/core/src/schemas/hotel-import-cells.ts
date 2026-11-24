import { rupeesToMinor } from "../forms.js";
import type { Money } from "./common.js";
import type { VenueOtherLayout } from "./hotel-rooms-venues.js";

/*
 * How the staff import reads a cell, for every kind (TW-25; D-178, D-181): list cells, enum cells, a
 * venue's other layouts and its capacities, and a rate's money cells (Slice 4). Pure and Hermes-safe (no
 * `normalize`, no Unicode property escapes), so the API's CSV reader and the template help in the staff
 * app say the same thing. Each helper reads one non-blank cell; the row schemas then check bounds.
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

/**
 * The largest amount a money cell takes, in rupees (D-184, Slice 4): well inside a rate's numeric(14,2)
 * column, and in whole paise far inside the integers JavaScript holds exactly.
 */
export const HOTEL_IMPORT_MAX_RUPEES = 10_000_000_000;

/**
 * Why a money cell is refused: anything but rupees as a number, a currency sign or word (the rupee sign,
 * Rs, INR) among them, a third decimal, or a comma out of place.
 */
export const RUPEES_CELL_MESSAGE =
  "Write the amount in rupees as a number, such as 12500 or 12,500.50";

/** Why a money cell holding a range is refused: a range's upper bound has a column of its own. */
export const RUPEES_RANGE_MESSAGE = "Put a range's upper bound in amountMax";

/** Why a money cell over {@link HOTEL_IMPORT_MAX_RUPEES} is refused. */
export const RUPEES_LIMIT_MESSAGE = "Write an amount of at most 10,000,000,000 rupees";

/**
 * Rupees as digits: no commas, or commas grouping thousands as most of the world writes them (1,234,567)
 * or as India does (12,34,567, the grouping the staff app shows), then at most two decimals.
 */
const RUPEES = /^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/;

/** Two amounts joined by a hyphen, a dash or "to", whatever marks surround them. */
const RUPEES_RANGE = /^\D*\d[\d,.]*\s*(?:-|–|—|to)\s*\D*\d[\d,.]*\D*$/i;

/** No money cell that long holds a range; the guard keeps the range test short. */
const RANGE_CELL_MAX_LENGTH = 64;

/** A money cell read: the amount in paise, or why the cell is refused. */
export type RupeesCellRead = { readonly money: Money } | { readonly problem: string };

/**
 * A money cell as the amount it names, in whole paise with no floating point (D-184): rupees as digits,
 * commas grouping thousands either way, at most two decimals, at most {@link HOTEL_IMPORT_MAX_RUPEES}.
 * A currency sign or word, or a range, is refused with words saying what to write instead. A rate whose
 * unit is `percent` holds the percentage the same way.
 *
 * @example
 * parseRupeesCell("12,500.50"); // { money: { minor: 1250050, currency: "INR" } }
 * parseRupeesCell("1,25,000"); // { money: { minor: 12500000, currency: "INR" } }
 * parseRupeesCell("Rs 12500"); // { problem: RUPEES_CELL_MESSAGE }
 * parseRupeesCell("12000-15000"); // { problem: RUPEES_RANGE_MESSAGE }
 */
export function parseRupeesCell(text: string): RupeesCellRead {
  const cell = text.trim();
  if (!RUPEES.test(cell)) {
    const isRange = cell.length <= RANGE_CELL_MAX_LENGTH && RUPEES_RANGE.test(cell);
    return { problem: isRange ? RUPEES_RANGE_MESSAGE : RUPEES_CELL_MESSAGE };
  }
  const minor = rupeesToMinor(cell);
  if (minor === null || minor > HOTEL_IMPORT_MAX_RUPEES * 100)
    return { problem: RUPEES_LIMIT_MESSAGE };
  return { money: { minor, currency: "INR" } };
}
