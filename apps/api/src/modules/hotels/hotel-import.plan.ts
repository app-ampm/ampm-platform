import {
  HOTEL_AREA_PAIRS,
  HOTEL_IMPORT_COLUMNS,
  type HotelImportColumn,
  type HotelImportRow,
} from "@ampm/core";

import { settleAreas } from "./hotel-areas.js";
import { sameValue } from "./hotel-changes.js";
import type { ImportRow } from "./hotel-import.file.js";
import { slugify } from "./hotel-import.js";
import {
  allowedCuisines,
  checkPostalCode,
  CUISINE_REFUSED,
  keptPostalCodeProblem,
  NEW_DESTINATION_COUNTRY,
  resolveCuisines,
} from "./hotel-profile-rules.js";
import { HOTEL_PROFILE_KEYS, type HotelProfileKey } from "./hotel-write.js";

/*
 * What each row of a hotels file does (D-181; plan §4.8). Pure, with no Prisma, so a later slice can lift
 * it into a shared change set. A row names its hotel by web address. With no hotel there it creates one;
 * otherwise it updates only the cells that are filled and differ from what is stored, compared at the
 * column's precision; nothing else changes, so a blank never clears and status and the flags move only
 * when their cell says so. A row moves its hotel to another destination only when its slug cell names
 * the hotel: a web address made from a name may be another property's of the same name elsewhere. The
 * total event space follows the units rule (core `areaWrite`, D-178): a filled sq ft gives its m², and an m²
 * filled alone on a hotel that stores sq ft clears that sq ft, both then named changed. A row
 * is refused when its web address belongs to a deleted hotel or appears earlier in the file, its
 * destination was deleted, its postal code (or, on a move, the one the hotel keeps) or cuisines break the
 * profile rules, or it does what the uploader's keys do not allow: change an existing hotel, set the
 * internal rating or notes, create a destination, add an image. A row naming a live hotel also needs the
 * profile read: without it the row is refused with one reason, so nothing the plan answers tells the
 * uploader where a hotel they cannot read is filed or what it holds. The dry run and the apply share this.
 */

/** One field a row was refused on. */
export interface FieldError {
  readonly field: string;
  readonly message: string;
}

/** Where a stored hotel is filed, and the postal code it keeps: what decides a move and its PIN check. */
export interface ImportFiling {
  readonly destinationSlug: string;
  readonly postalCode: string | null;
}

/**
 * A hotel a row names, deleted ones included (a deleted hotel keeps its slug), holding only what the
 * uploader may read. `filing` is there for a profile reader alone: for anyone else it is null, and a row
 * naming the live hotel is refused. `values` holds the profile for a profile reader and the internal
 * rating and notes for a notes reader; a column without a value is compared as different, so whether a
 * filled cell is a change never turns on a value they cannot read.
 */
export interface ImportTarget {
  readonly id: string;
  readonly deletedAt: Date | null;
  readonly filing: ImportFiling | null;
  readonly values: Readonly<Partial<Record<HotelProfileKey, unknown>>>;
}

/** A destination a row names, deleted ones included. */
export interface ImportDestination {
  readonly id: string;
  readonly country: string;
  readonly deletedAt: Date | null;
}

/** What the plan reads beside the rows. */
export interface ImportContext {
  readonly hotels: ReadonlyMap<string, ImportTarget>;
  readonly destinations: ReadonlyMap<string, ImportDestination>;
  readonly cuisineOptions: readonly string[];
  /** `hotels.hotel_profiles_client_fields.update`: may a row change an existing hotel, its images included? */
  readonly canUpdate: boolean;
  /** `hotels.hotel_internal_rating_notes.update`: may a row fill the internal rating or notes? */
  readonly canWriteNotes: boolean;
  /** `hotels.destinations.create`: may a row name a destination that does not exist yet? */
  readonly canCreateDestinations: boolean;
  /** `hotels.hotel_media_rights_status.create`: may a row fill `imageRef`? */
  readonly canAddMedia: boolean;
}

/** One row's plan. `row` is as written: postal code without spaces, cuisines in their configured spelling. */
export type RowPlan =
  | {
      readonly outcome: "error";
      readonly line: number;
      readonly slug: string | null;
      readonly name: string | null;
      readonly errors: readonly FieldError[];
    }
  | {
      readonly outcome: "create";
      readonly line: number;
      readonly slug: string;
      readonly row: HotelImportRow;
      readonly changedFields: readonly HotelImportColumn[];
    }
  | {
      readonly outcome: "update";
      readonly line: number;
      readonly slug: string;
      readonly hotelId: string;
      readonly row: HotelImportRow;
      readonly changed: readonly HotelProfileKey[];
      readonly movesDestination: boolean;
      readonly changedFields: readonly HotelImportColumn[];
    }
  | {
      readonly outcome: "unchanged";
      readonly line: number;
      readonly slug: string;
      readonly hotelId: string;
      readonly row: HotelImportRow;
    };

const NO_SLUG = "Give the hotel a web address (slug): its name has no letters or digits";
const DELETED_HOTEL = "A deleted hotel used this web address; give this hotel another one";
const DELETED_DESTINATION = "This destination was deleted; use another one";
const NOTES_REFUSED = "You cannot change a hotel's internal rating or notes";
const UPDATE_REFUSED =
  "A hotel already has this web address, and you cannot change existing hotels";
const READ_REFUSED = "A hotel already has this web address, and you cannot read existing hotels";
const IMAGE_UPDATE_REFUSED =
  "A hotel already has this web address, and you cannot add images to existing hotels";
const IMAGE_REFUSED = "You cannot add hotel images";
const DESTINATION_REFUSED =
  "This destination does not exist yet, and you cannot create destinations; add it under Destinations first";

const movedByName = (destinationSlug: string): string =>
  `A hotel with this name is filed under ${destinationSlug}; give this row its own slug, or that hotel's slug to move it`;

/** The columns that do not fill a hotel column (the slug keys the row; the rest are not stored on it). */
const NOT_STORED = new Set<HotelImportColumn>(["slug", "destinationName", "imageRef"]);

/**
 * Every row's plan, in file order. The first row to use a web address is planned; a later one is refused.
 *
 * @example
 * const plans = planImport(file.rows, context);
 */
export function planImport(
  rows: readonly ImportRow<HotelImportRow>[],
  context: ImportContext,
): RowPlan[] {
  const firstLine = new Map<string, number>();
  return rows.map(({ line, row }) => {
    const slug = importSlug(row);
    const earlier = firstLine.get(slug);
    if (earlier === undefined) firstLine.set(slug, line);
    return planRow(line, slug, row, earlier, context);
  });
}

/** The web address a row names: its slug cell, else one made from its name ("" when that has none). */
export function importSlug(row: HotelImportRow): string {
  return row.slug ?? slugify(row.name);
}

function planRow(
  line: number,
  slug: string,
  input: HotelImportRow,
  earlierLine: number | undefined,
  context: ImportContext,
): RowPlan {
  const target = context.hotels.get(slug) ?? null;
  const filing = target?.deletedAt === null ? target.filing : null;
  const { row, errors } = checkRow(input, slug, earlierLine, { target, filing }, context);
  const name = input.name;
  if (errors.length > 0) return { outcome: "error", line, slug: slug || null, name, errors };
  if (target === null) {
    return { outcome: "create", line, slug, row, changedFields: filledColumns(row) };
  }
  if (filing === null) {
    const errors = [{ field: "slug", message: READ_REFUSED }];
    return { outcome: "error", line, slug, name, errors };
  }
  return planExisting(line, slug, row, { target, filing }, context.canUpdate);
}

/**
 * The hotel a row names as the plan may read it: none, a deleted one or a live one; `filing` only for a
 * live hotel the uploader reads.
 */
interface Named {
  readonly target: ImportTarget | null;
  readonly filing: ImportFiling | null;
}

/** Where a live hotel the row moves is filed now, or null when the row moves none (or none it reads). */
function movedFrom(row: HotelImportRow, filing: ImportFiling | null): ImportFiling | null {
  return filing !== null && row.destinationSlug !== filing.destinationSlug ? filing : null;
}

/**
 * A checked row naming a live hotel: unchanged, or an update of the filled cells that differ (and of its
 * destination), or refused when the uploader may not change existing hotels. An image is a change to the
 * hotel too, so it needs the update key, though it never makes the row an update: it is registered once
 * per hotel and reference, and counted apart from the rows.
 */
function planExisting(
  line: number,
  slug: string,
  row: HotelImportRow,
  { target, filing }: { readonly target: ImportTarget; readonly filing: ImportFiling },
  canUpdate: boolean,
): RowPlan {
  const changed = HOTEL_PROFILE_KEYS.filter(
    (key) => row[key] !== undefined && !sameValue(key, row[key], target.values[key]),
  );
  const movesDestination = movedFrom(row, filing) !== null;
  const writes = changed.length > 0 || movesDestination;
  const refusal = canUpdate ? null : updateRefusal(writes, row.imageRef !== undefined);
  if (refusal) return { outcome: "error", line, slug, name: row.name, errors: [refusal] };
  if (!writes) return { outcome: "unchanged", line, slug, hotelId: target.id, row };
  const changedFields: HotelImportColumn[] = movesDestination
    ? ["destinationSlug", ...changed]
    : [...changed];
  return {
    outcome: "update",
    line,
    slug,
    hotelId: target.id,
    row,
    changed,
    movesDestination,
    changedFields,
  };
}

/** Why an uploader who may not change existing hotels is refused a row, or null when it changes nothing. */
function updateRefusal(writes: boolean, addsImage: boolean): FieldError | null {
  if (writes) return { field: "slug", message: UPDATE_REFUSED };
  return addsImage ? { field: "imageRef", message: IMAGE_UPDATE_REFUSED } : null;
}

/** The row as it would be written, and every reason it is refused. */
function checkRow(
  input: HotelImportRow,
  slug: string,
  earlierLine: number | undefined,
  { target, filing }: Named,
  context: ImportContext,
): { readonly row: HotelImportRow; readonly errors: FieldError[] } {
  const destination = context.destinations.get(input.destinationSlug) ?? null;
  const errors = [
    ...identityErrors(slug, earlierLine, target, destination),
    ...placeErrors(input, { target, filing }, destination, context.canCreateDestinations),
    ...grantErrors(input, context),
  ];
  const postal = postalCheck(input, destination, filing);
  const cuisines = cuisineCheck(input, target, context.cuisineOptions);
  const stored = filing === null ? null : (target?.values ?? null);
  const row = settleAreas(
    { ...input, ...postal.value, ...cuisines.value },
    HOTEL_AREA_PAIRS,
    stored,
  );
  return { row, errors: [...errors, ...postal.errors, ...cuisines.errors] };
}

function identityErrors(
  slug: string,
  earlierLine: number | undefined,
  target: ImportTarget | null,
  destination: ImportDestination | null,
): FieldError[] {
  const errors: FieldError[] = [];
  if (slug === "") errors.push({ field: "slug", message: NO_SLUG });
  else if (earlierLine !== undefined) {
    errors.push({ field: "slug", message: `Line ${earlierLine} already uses this web address` });
  }
  if (target?.deletedAt) errors.push({ field: "slug", message: DELETED_HOTEL });
  if (destination?.deletedAt) {
    errors.push({ field: "destinationSlug", message: DELETED_DESTINATION });
  }
  return errors;
}

/**
 * Where the row files its hotel. Moving a live hotel to another destination needs the hotel's slug in
 * the row, never one made from the name; a destination the row would create needs the destinations key.
 */
function placeErrors(
  row: HotelImportRow,
  { target, filing }: Named,
  destination: ImportDestination | null,
  canCreateDestinations: boolean,
): FieldError[] {
  const from = movedFrom(row, filing);
  if (from !== null && row.slug === undefined) {
    return [{ field: "slug", message: movedByName(from.destinationSlug) }];
  }
  const creates = destination === null && (target === null || from !== null);
  return creates && !canCreateDestinations
    ? [{ field: "destinationSlug", message: DESTINATION_REFUSED }]
    : [];
}

/**
 * The keys a filled cell needs whatever it holds: the notes key for the internal rating or notes (D-171),
 * the media key for an image.
 */
function grantErrors(row: HotelImportRow, context: ImportContext): FieldError[] {
  const notes = context.canWriteNotes
    ? []
    : (["internalRating", "internalNotes"] as const).filter((field) => row[field] !== undefined);
  const errors: FieldError[] = notes.map((field) => ({ field, message: NOTES_REFUSED }));
  if (row.imageRef !== undefined && !context.canAddMedia) {
    errors.push({ field: "imageRef", message: IMAGE_REFUSED });
  }
  return errors;
}

/**
 * A postal code without its spaces, checked against the destination's country (a new one is India). A
 * row that moves a hotel without giving a postal code checks the one the hotel keeps.
 */
function postalCheck(
  row: HotelImportRow,
  destination: ImportDestination | null,
  filing: ImportFiling | null,
): { readonly value: { postalCode?: string }; readonly errors: FieldError[] } {
  const country = destination?.country ?? NEW_DESTINATION_COUNTRY;
  if (typeof row.postalCode === "string") {
    const { postalCode, problem } = checkPostalCode(row.postalCode, country);
    return {
      value: { postalCode },
      errors: problem ? [{ field: "postalCode", message: problem }] : [],
    };
  }
  const from = movedFrom(row, filing);
  const kept = from === null ? null : keptPostalCodeProblem(from.postalCode, country);
  return { value: {}, errors: kept ? [{ field: "postalCode", message: kept }] : [] };
}

/** Cuisines in their configured spelling: an option, "Other", or one the hotel already carries. */
function cuisineCheck(
  row: HotelImportRow,
  target: ImportTarget | null,
  options: readonly string[],
): { readonly value: { cuisines?: string[] }; readonly errors: FieldError[] } {
  if (!row.cuisines) return { value: {}, errors: [] };
  const existing = target?.values.cuisines;
  const allowed = allowedCuisines(options, isStringList(existing) ? existing : null);
  const { labels, unknown } = resolveCuisines(row.cuisines, allowed);
  return {
    value: { cuisines: labels },
    errors: unknown.map((index) => ({ field: `cuisines.${index}`, message: CUISINE_REFUSED })),
  };
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** A create row's filled columns, in template order: what the new hotel takes from the file. */
function filledColumns(row: HotelImportRow): HotelImportColumn[] {
  return HOTEL_IMPORT_COLUMNS.filter(
    (column) => !NOT_STORED.has(column) && row[column] !== undefined,
  );
}
