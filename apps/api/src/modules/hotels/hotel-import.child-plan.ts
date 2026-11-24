import {
  fieldChanges,
  matchRowsByName,
  type HotelAreaPair,
  type HotelFieldKinds,
  type HotelFieldValues,
  type HotelImportChangedField,
  type HotelRowMatch,
} from "@ampm/core";

import { settleAreas } from "./hotel-areas.js";
import type { ChildImportGrants } from "./hotel-audience.js";
import { atScale } from "./hotel-changes.js";
import type { ImportRow } from "./hotel-import.file.js";
import type { FieldError } from "./hotel-import.plan.js";

/*
 * What each row of a rooms or venues file does (D-178, D-181; plan §4.8). Pure, shared by both kinds. A
 * row names its hotel by web address, which must be a live hotel, and matches one of the hotel's live rows
 * by name, exactly once normalised (core `matchRowsByName`); a soft-deleted row never matches, so a retired
 * name is created again. A matched row keeps its stored name (no rename by import) and updates only the
 * filled cells that differ (core `fieldChanges` with the units rule, each decimal at its column's scale,
 * so a value the column rounds is compared as it will be stored), so a blank never clears; no match
 * creates the row. Nothing is ever deleted or recreated: rate items point at rooms and venues. A row is
 * refused when its hotel is missing or deleted, its name repeats an earlier line's for the hotel, two live
 * rows share its name, a new row lacks what its kind needs, or it does what the uploader's keys do not
 * allow: create needs the create key, a change the update key, and naming a stored row at all the read
 * key, so a preview never tells an uploader whether a cell matches a row they cannot read.
 */

/** A rooms or venues row as both kinds read it: its hotel's web address and its name. */
export interface ChildImportRow {
  readonly hotelSlug: string;
  readonly name: string;
}

/** A hotel a row names, deleted ones included. */
export interface ChildHotel {
  readonly id: string;
  readonly deletedAt: Date | null;
}

/** One of a hotel's live rooms or venues as the plan compares it, its values as the staff view reads them. */
export interface StoredChild<K extends string> {
  readonly id: string;
  readonly name: string;
  readonly values: HotelFieldValues<K>;
}

/** What the plan reads beside the rows. */
export interface ChildPlanContext<K extends string> {
  /** The hotels the file names, by web address. */
  readonly hotels: ReadonlyMap<string, ChildHotel>;
  /** Each named live hotel's live rooms or venues, by hotel id. */
  readonly rows: ReadonlyMap<string, readonly StoredChild<K>[]>;
  readonly grants: ChildImportGrants;
}

/** What a new row is written as, or why it cannot be created. */
export type ChildCreate<Create> =
  { readonly data: Create } | { readonly errors: readonly FieldError[] };

/** What one kind adds to the shared plan. */
export interface ChildPlanRules<Row, K extends string, Create, Patch> {
  /** "room" or "venue", and its plural, for the refusals. */
  readonly noun: string;
  readonly plural: string;
  readonly fields: HotelFieldKinds<K>;
  readonly areas: readonly HotelAreaPair<K>[];
  /**
   * The decimal places of each fixed-point column (a venue's metres keep two): a row's value is taken at
   * that scale before it is compared or written, so a value its column rounds plans no change it cannot
   * make, and importing the same file again settles.
   */
  readonly scales: Readonly<Partial<Record<K, number>>>;
  /** A new row's columns from its settled cells, or what it lacks. */
  toCreate(row: Row): ChildCreate<Create>;
  /** A matched row's changed columns from its settled cells. */
  toPatch(row: Row, changed: readonly K[]): Patch;
  /** A new row's filled columns, in template order: what the report names. */
  filled(row: Row): readonly HotelImportChangedField[];
}

/** The report fields every plan carries; a matched row reports its stored name. */
interface PlanKey {
  readonly line: number;
  readonly slug: string;
  readonly name: string;
}

/** One row's plan. */
export type ChildRowPlan<K extends string, Create, Patch> =
  | (PlanKey & { readonly outcome: "error"; readonly errors: readonly FieldError[] })
  | (PlanKey & {
      readonly outcome: "create";
      readonly hotelId: string;
      readonly data: Create;
      readonly changedFields: readonly HotelImportChangedField[];
    })
  | (PlanKey & {
      readonly outcome: "update";
      readonly hotelId: string;
      readonly targetId: string;
      readonly patch: Patch;
      readonly changedFields: readonly K[];
    })
  | (PlanKey & {
      readonly outcome: "unchanged";
      readonly hotelId: string;
      readonly targetId: string;
    });

const NO_HOTEL: FieldError = { field: "hotelSlug", message: "No hotel has this web address" };
const DELETED_HOTEL: FieldError = { field: "hotelSlug", message: "This hotel was deleted" };

/** A row's live hotel, its match among the hotel's live rows and the lines of the hotel's rows. */
interface Matched<K extends string> {
  readonly hotelId: string;
  readonly match: HotelRowMatch<StoredChild<K>>;
  readonly lines: readonly number[];
}

/** The shape of a row a kind plans: both kinds' keys and the compared fields. */
export type PlannedRow<K extends string> = ChildImportRow & HotelFieldValues<K>;

/**
 * Every row's plan, in file order.
 *
 * @example
 * const plans = planChildRows(file.rows, context, ROOM_PLAN_RULES);
 */
export function planChildRows<
  Row extends PlannedRow<K>,
  K extends HotelImportChangedField,
  Create,
  Patch,
>(
  rows: readonly ImportRow<Row>[],
  context: ChildPlanContext<K>,
  rules: ChildPlanRules<Row, K, Create, Patch>,
): ChildRowPlan<K, Create, Patch>[] {
  const located = locate(rows, context);
  return rows.map(({ line, row }, index): ChildRowPlan<K, Create, Patch> => {
    const where = located[index] ?? NO_HOTEL;
    const key = { line, slug: row.hotelSlug, name: row.name };
    if ("field" in where) return { ...key, outcome: "error", errors: [where] };
    return planMatched(key, atColumnScale(row, rules.scales), where, context.grants, rules);
  });
}

/** The row with each fixed-point value at its column's scale, as the column will store it. */
function atColumnScale<Row extends PlannedRow<K>, K extends string>(
  row: Row,
  scales: Readonly<Partial<Record<K, number>>>,
): Row {
  let scaled: Row = row;
  for (const key of Object.keys(scales).filter((field): field is K => field in scales)) {
    const value = scaled[key];
    const scale = scales[key];
    if (typeof value === "number" && scale !== undefined) {
      scaled = { ...scaled, [key]: atScale(value, scale) };
    }
  }
  return scaled;
}

/** Each row's hotel and its match among the hotel's live rows (matched per hotel, in file order). */
function locate<K extends string>(
  rows: readonly ImportRow<ChildImportRow>[],
  context: ChildPlanContext<K>,
): (Matched<K> | FieldError)[] {
  const hotels = rows.map(({ row }) => context.hotels.get(row.hotelSlug));
  const byHotel = new Map<string, number[]>();
  hotels.forEach((hotel, index) => {
    if (hotel === undefined || hotel.deletedAt !== null) return;
    const indexes = byHotel.get(hotel.id);
    if (indexes) indexes.push(index);
    else byHotel.set(hotel.id, [index]);
  });
  const matched = new Map<number, Matched<K>>();
  for (const [hotelId, indexes] of byHotel) {
    const names = indexes.map((index) => rows[index]?.row.name ?? "");
    const lines = indexes.map((index) => rows[index]?.line ?? 0);
    matchRowsByName(context.rows.get(hotelId) ?? [], names).forEach((match, at) => {
      const index = indexes[at];
      if (index !== undefined) matched.set(index, { hotelId, match, lines });
    });
  }
  return hotels.map((hotel, index) => {
    if (hotel === undefined) return NO_HOTEL;
    if (hotel.deletedAt !== null) return DELETED_HOTEL;
    return matched.get(index) ?? NO_HOTEL;
  });
}

/** A row whose hotel is live: refused, created, or matched to one stored row. */
function planMatched<Row extends PlannedRow<K>, K extends HotelImportChangedField, Create, Patch>(
  key: PlanKey,
  row: Row,
  where: Matched<K>,
  grants: ChildImportGrants,
  rules: ChildPlanRules<Row, K, Create, Patch>,
): ChildRowPlan<K, Create, Patch> {
  const { match } = where;
  const refuse = (message: string): ChildRowPlan<K, Create, Patch> => ({
    ...key,
    outcome: "error",
    errors: [{ field: "name", message }],
  });
  if (match.match === "repeated") {
    const first = where.lines[match.firstIndex] ?? key.line;
    return refuse(`Line ${first} already names this ${rules.noun} for this hotel`);
  }
  if (match.match === "new") return planCreate(key, row, where.hotelId, grants, rules);
  if (!grants.readsRows) {
    return refuse(`A ${rules.noun} already has this name, and you cannot read ${rules.plural}`);
  }
  if (match.match === "ambiguous") {
    return refuse(`Two ${rules.plural} are named ${key.name}; rename one in the staff app first`);
  }
  if (!grants.canUpdate && changesOf(row, match.row, rules).length > 0) {
    return refuse(`A ${rules.noun} already has this name, and you cannot change ${rules.plural}`);
  }
  return planExisting(key, row, where.hotelId, match.row, rules);
}

/** The compared fields a row changes on a stored row, the units rule included. */
function changesOf<Row extends PlannedRow<K>, K extends string, Create, Patch>(
  row: Row,
  stored: StoredChild<K>,
  rules: ChildPlanRules<Row, K, Create, Patch>,
): K[] {
  return fieldChanges(stored.values, row, rules.fields, { areas: rules.areas });
}

/** A row no live row matches: a new room or venue, if the kind's needs and the create key allow it. */
function planCreate<Row extends PlannedRow<K>, K extends string, Create, Patch>(
  key: PlanKey,
  row: Row,
  hotelId: string,
  grants: ChildImportGrants,
  rules: ChildPlanRules<Row, K, Create, Patch>,
): ChildRowPlan<K, Create, Patch> {
  const settled = settleAreas(row, rules.areas, null);
  const created = rules.toCreate(settled);
  const errors = "errors" in created ? [...created.errors] : [];
  if (!grants.canCreate) errors.push({ field: "name", message: `You cannot add ${rules.plural}` });
  if ("errors" in created || errors.length > 0) return { ...key, outcome: "error", errors };
  const changedFields = rules.filled(settled);
  return { ...key, outcome: "create", hotelId, data: created.data, changedFields };
}

/** A row matching one live row the uploader may change: unchanged, or an update of what differs. */
function planExisting<Row extends PlannedRow<K>, K extends string, Create, Patch>(
  key: PlanKey,
  row: Row,
  hotelId: string,
  stored: StoredChild<K>,
  rules: ChildPlanRules<Row, K, Create, Patch>,
): ChildRowPlan<K, Create, Patch> {
  const matched = { ...key, name: stored.name, hotelId, targetId: stored.id };
  const changed = changesOf(row, stored, rules);
  if (changed.length === 0) return { ...matched, outcome: "unchanged" };
  const patch = rules.toPatch(settleAreas(row, rules.areas, stored.values), changed);
  return { ...matched, outcome: "update", patch, changedFields: changed };
}
