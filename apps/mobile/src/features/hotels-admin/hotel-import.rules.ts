import {
  HOTEL_AREA_PAIRS,
  HOTEL_IMPORT_LIST_SEPARATOR,
  HOTEL_IMPORT_MAX_BYTES,
  HOTEL_IMPORT_MAX_ROWS,
  HOTEL_IMPORT_PREVIEW_TTL_HOURS,
  HOTEL_IMPORT_TEMPLATES,
  ROOM_AREA_PAIRS,
  VENUE_AREA_PAIRS,
  type HotelAreaPair,
  type HotelImportKind,
} from "@ampm/core";

import { UNIT_TYPE_CHOICES, VENUE_SETTINGS, VENUE_TYPES } from "./subresources.format";

/*
 * The rules of each import kind's file, as the TW-25 template help states them (D-181; Slice 3). Built
 * from core's templates and area pairs, the lists the server reads by, so the help never drifts from
 * them: the required columns, how list, enum, capacity and layout cells read, and the units rule. Pure.
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

function requiredRule(kind: HotelImportKind): string {
  const required = `Required: ${HOTEL_IMPORT_TEMPLATES[kind].requiredColumns.join(", ")}`;
  return kind === "venues"
    ? `${required}; a new venue also needs venueType and setting.`
    : `${required}.`;
}

/** The units rule over a kind's area pairs: a filled sq ft gives the m². */
function unitsRule(pairs: readonly HotelAreaPair[]): string {
  const fromFeet = pairs.map((pair) => `${pair.sqft} gives ${pair.sqm}`).join(", ");
  return (
    `A filled sq ft column gives its m² (${fromFeet}); an m² given without its sq ft becomes ` +
    "the figure and clears any sq ft stored."
  );
}

function listRule(kind: HotelImportKind): string {
  const columns = HOTEL_IMPORT_TEMPLATES[kind].listColumns.join(", ");
  return (
    `Separate the entries of a list cell (${columns}) with "${HOTEL_IMPORT_LIST_SEPARATOR}" or a ` +
    "line break; a comma stays inside an entry."
  );
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

const KIND_RULES: Readonly<Record<HotelImportKind, readonly string[]>> = {
  hotels: HOTEL_RULES,
  rooms: ROOM_RULES,
  venues: VENUE_RULES,
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
    listRule(kind),
    "Use the template's column names: an unknown column is refused.",
    `Up to ${MAX_SIZE_TEXT} and ${HOTEL_IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows. Save the file ` +
      "as CSV UTF-8 (in Excel: CSV UTF-8): plain CSV turns ₹ and Indic names into question marks.",
    `Validate first: it checks the file and saves nothing. ${PREVIEW_TTL_TEXT}.`,
  ];
}
