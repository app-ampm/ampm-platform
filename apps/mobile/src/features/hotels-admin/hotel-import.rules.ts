import {
  HOTEL_AREA_PAIRS,
  HOTEL_IMPORT_LIST_SEPARATOR,
  HOTEL_IMPORT_MAX_BYTES,
  HOTEL_IMPORT_MAX_ROWS,
  HOTEL_IMPORT_PREVIEW_TTL_HOURS,
  HOTEL_IMPORT_TEMPLATES,
  hotelRateItemUnit,
  RATE_ITEM_TYPES,
  ROOM_AREA_PAIRS,
  VENUE_AREA_PAIRS,
  type HotelAreaPair,
  type HotelImportKind,
} from "@ampm/core";

import { rateItemTypeCell, rateUnitCell } from "./hotel-import.rates";
import { UNIT_TYPE_CHOICES, VENUE_SETTINGS, VENUE_TYPES } from "./subresources.format";

/*
 * The rules of each import kind's file, as the TW-25 template help states them (D-181, D-183, D-184;
 * Slices 3 and 4). Built from core's templates, area pairs and enums, the lists the server reads by, so
 * the help never drifts from them: the required columns, how list, enum, capacity, layout and money
 * cells read, the units rule, and where imported rates land. Pure.
 */

/** The largest file, as the help and the size check say it: "5 MB". */
export const MAX_SIZE_TEXT = `${HOTEL_IMPORT_MAX_BYTES / (1024 * 1024)} MB`;

/** How long a preview can be imported, as the screen says it. */
export const PREVIEW_TTL_TEXT = `A preview can be imported for ${HOTEL_IMPORT_PREVIEW_TTL_HOURS} hours`;

/** "a, b or c". */
function either(values: readonly string[]): string {
  const last = values[values.length - 1] ?? "";
  return values.length < 2 ? last : `${values.slice(0, -1).join(", ")} or ${last}`;
}

/** What a new record needs beyond the required columns (the server refuses its row without them). */
const NEW_RECORD_NEEDS: Partial<Record<HotelImportKind, string>> = {
  venues: "a new venue also needs venueType and setting",
  rates: "a new item also needs amount and unit",
};

function requiredRule(kind: HotelImportKind): string {
  const required = `Required: ${HOTEL_IMPORT_TEMPLATES[kind].requiredColumns.join(", ")}`;
  const needs = NEW_RECORD_NEEDS[kind];
  return needs === undefined ? `${required}.` : `${required}; ${needs}.`;
}

/** The units rule over a kind's area pairs: a filled sq ft gives the m². */
function unitsRule(pairs: readonly HotelAreaPair[]): string {
  const fromFeet = pairs.map((pair) => `${pair.sqft} gives ${pair.sqm}`).join(", ");
  return (
    `A filled sq ft column gives its m² (${fromFeet}); an m² given without its sq ft becomes ` +
    "the figure and clears any sq ft stored."
  );
}

/** How a list cell reads, or none for a kind without list cells (rates). */
function listRules(kind: HotelImportKind): readonly string[] {
  const { listColumns } = HOTEL_IMPORT_TEMPLATES[kind];
  if (listColumns.length === 0) return [];
  return [
    `Separate the entries of a list cell (${listColumns.join(", ")}) with ` +
      `"${HOTEL_IMPORT_LIST_SEPARATOR}" or a line break; a comma stays inside an entry.`,
  ];
}

const ENUM_CASE = "in any case, with a space or a hyphen for the underscore";

function matchRule(noun: string): string {
  return (
    `Each row names its hotel by web address (hotelSlug) and its ${noun} by name: a name the hotel ` +
    `has updates that ${noun}, a new name adds one. An import never renames or removes a ${noun}; on ` +
    "one already there a blank cell leaves its value unchanged."
  );
}

const HOTEL_RULES: readonly string[] = [
  "On a hotel already in the catalogue a blank cell leaves its value unchanged; status and the demo, " +
    "showcase and internal columns change only when filled.",
  "Yes-or-no columns take true or false (yes and no, or 1 and 0, work too).",
  unitsRule(HOTEL_AREA_PAIRS),
];

const ROOM_RULES: readonly string[] = [
  matchRule("room category"),
  `unitType takes ${either(UNIT_TYPE_CHOICES.filter((choice) => choice !== "unset"))}, ${ENUM_CASE}.`,
  unitsRule(ROOM_AREA_PAIRS),
];

const VENUE_RULES: readonly string[] = [
  matchRule("venue"),
  `venueType takes ${either(VENUE_TYPES)}; setting takes ${either(VENUE_SETTINGS)}, ${ENUM_CASE}.`,
  "Each capacity cell takes one number, the most guests: capacityBanquet seated at round tables " +
    "for dinner, capacityTheatre in rows of chairs, capacityReception floating at a standing " +
    "reception or cocktails. Put a range such as 600-700 in capacityNotes.",
  "otherLayouts lists each layout as Name: max or Name: min-max, separated by |, for example " +
    "Classroom: 120 | U-shape: 30-40.",
  `${unitsRule(VENUE_AREA_PAIRS)} Lengths are in metres.`,
];

// The rates loader (D-184): draft cards only, hidden items, a card verified in the staff app (D-170).
const RATE_RULES: readonly string[] = [
  "Each row names its hotel by web address (hotelSlug), its rate card by name (cardName) and its " +
    "item by itemType with roomName or venueName: an item the card has is updated, a new one is " +
    "added. An import never renames or removes a card or an item; on an item already there a blank " +
    "cell leaves its value unchanged.",
  'A second row for the same item on the same card is refused ("Line N already names this item"), ' +
    "so two prices for one room go on separate cards.",
  "Rates load only into draft cards: a row naming a verified or stale card is refused, so give the " +
    "file a new card name. A name none of the hotel's current cards has (a retired card's is free) " +
    "adds a draft card, dated by the validFrom and validTo (YYYY-MM-DD) of the first of its rows " +
    "that can be imported. An import never changes a card's dates: on every other row leave them " +
    "blank or give the card's own.",
  "New items start hidden from clients, and an import never changes whether clients see an item. A " +
    "card reaches clients once it is verified on the hotel's Rate cards tab against a rates " +
    "verification, and an item once it is shown to clients there.",
  "roomName names one of the hotel's room categories and venueName one of its venues, by name: an " +
    "item is for a room, a venue or neither, never both.",
  "amount and amountMax are in rupees as a number, such as 12500 or 12,500.50, with no ₹, Rs or " +
    "INR; for a range put its lower bound in amount and its upper bound in amountMax. With the unit " +
    "percent, amount is the percentage.",
  `itemType takes ${either(RATE_ITEM_TYPES.map(rateItemTypeCell))}; unit takes ` +
    `${either(hotelRateItemUnit.options.map(rateUnitCell))}; both in any case, with a hyphen or an ` +
    "underscore for a space.",
  "minQuantity is the fewest guests or rooms the rate needs, a whole number; isIndicative takes " +
    "true or false (yes and no, or 1 and 0, work too), a new item being indicative when it is blank; " +
    "inclusions says what the rate covers.",
];

const KIND_RULES: Readonly<Record<HotelImportKind, readonly string[]>> = {
  hotels: HOTEL_RULES,
  rooms: ROOM_RULES,
  venues: VENUE_RULES,
  rates: RATE_RULES,
};

/**
 * The rules of a kind's file, one per line, as the template help lists them.
 *
 * @example
 * importRules("venues")[0]; // "Required: hotelSlug, name; a new venue also needs venueType and setting."
 */
export function importRules(kind: HotelImportKind): readonly string[] {
  return [
    requiredRule(kind),
    ...KIND_RULES[kind],
    ...listRules(kind),
    "Use the template's column names: an unknown column is refused.",
    `Up to ${MAX_SIZE_TEXT} and ${HOTEL_IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows. Save the file ` +
      "as CSV UTF-8 (in Excel: CSV UTF-8): plain CSV turns ₹ and Indic names into question marks.",
    `Validate first: it checks the file and saves nothing. ${PREVIEW_TTL_TEXT}.`,
  ];
}
