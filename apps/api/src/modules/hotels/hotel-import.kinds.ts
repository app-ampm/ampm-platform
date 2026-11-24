import {
  HOTEL_IMPORT_TEMPLATES,
  hotelImportRow,
  hotelRateItemType,
  rateImportRow,
  roomImportRow,
  venueImportRow,
  type HotelImportKind,
  type HotelImportRow,
  type HotelImportRowItem,
  type HotelImportTemplate,
  type RateImportRow,
  type RoomImportRow,
  type VenueImportRow,
} from "@ampm/core";
import type { ZodType } from "zod";

import type { ImportType, Prisma } from "../../generated/prisma/client.js";
import type { Principal } from "../../policy/principal.types.js";
import type { ImportRow } from "./hotel-import.file.js";
import type { StoredRow } from "./hotel-import.job.js";
import { slugify } from "./hotel-import.js";
import type { RowReport } from "./hotel-import.report.js";

/*
 * The kinds of staff import (TW-25; D-181, D-183, D-184): each reads its own CSV template (core
 * `HOTEL_IMPORT_TEMPLATES`) into rows of its own schema, keeps its jobs under its own
 * `import_jobs.import_type`, and plans and writes its rows through its own importer
 * (hotel-import.hotels.ts, hotel-import.children.ts, hotel-import.rates.ts), which the service drives the
 * same way for every kind.
 */

/**
 * What a row names, as far as its cells say: its hotel's web address and its own name (a rates row, its
 * card's), and a rates row's item when its type reads.
 */
export interface ImportRowKey {
  readonly slug: string | null;
  readonly name: string | null;
  readonly item?: HotelImportRowItem;
}

/** One kind of import: its template, its row schema and how a row it refuses is named. */
export interface ImportKindSpec<Row> {
  readonly kind: HotelImportKind;
  readonly importType: ImportType;
  readonly template: HotelImportTemplate;
  readonly schema: ZodType<Row>;
  /** What a file refusal calls one of its rows ("The file has no room rows."). */
  readonly noun: string;
  /** The web address and name a row's cells give, for a row the schema refuses. */
  keyOf(values: Readonly<Record<string, unknown>>): ImportRowKey;
  /** A row as its preview's plan stores it: the row itself, which is plain JSON. */
  toJson(row: Row): Prisma.InputJsonValue;
}

/** The job an import writes under, and who is writing. */
export interface ImportJobRef {
  readonly importJobId: string;
  readonly actorId: string;
}

/** A by-reference image a hotels row registers once its import has committed. */
export interface ImportImageRef {
  readonly hotelId: string;
  readonly ref: string;
}

/** A preview's plan of its rows: each row's report, the rows to store with their targets' versions. */
export interface PlannedRows {
  readonly reports: readonly RowReport[];
  readonly stored: readonly StoredRow<Prisma.InputJsonValue>[];
  /** The destinations importing the rows would create (hotels only). */
  readonly newDestinations: number;
  /**
   * The images importing the rows would register (hotels only): an image never makes a row an update,
   * so without this a file that only adds images would read as one that changes nothing.
   */
  readonly newImages: number;
}

/** What an import's rows did inside its transaction. */
export interface AppliedRows {
  readonly reports: readonly RowReport[];
  readonly newDestinations: number;
  /** The images to register after the commit (hotels only). */
  readonly imageRefs: readonly ImportImageRef[];
}

/**
 * How one kind is previewed and imported: plan the file's rows against the catalogue as it stands (a
 * preview writes nothing), re-plan a stored preview's rows inside the import's transaction and write the
 * valid ones, each audited, and finish after the commit (a hotels import registers its images).
 */
export interface KindImporter<Row> {
  readonly spec: ImportKindSpec<Row>;
  plan(rows: readonly ImportRow<Row>[], principal: Principal): Promise<PlannedRows>;
  apply(
    rows: readonly StoredRow<Row>[],
    principal: Principal,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<AppliedRows>;
  afterCommit(applied: AppliedRows, actorId: string): Promise<number>;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/** A hotels row is keyed by its slug cell, else the web address its name makes. */
function hotelKey(values: Readonly<Record<string, unknown>>): ImportRowKey {
  const name = text(values["name"]);
  const slug = text(values["slug"]) ?? (name === null ? null : slugify(name) || null);
  return { slug, name };
}

/** A rooms or venues row names its hotel by web address and itself by name. */
function childKey(values: Readonly<Record<string, unknown>>): ImportRowKey {
  return { slug: text(values["hotelSlug"]), name: text(values["name"]) };
}

/** The Hotels template (Slice 2). */
export const HOTELS_IMPORT: ImportKindSpec<HotelImportRow> = {
  kind: "hotels",
  importType: "hotels",
  template: HOTEL_IMPORT_TEMPLATES.hotels,
  schema: hotelImportRow,
  noun: "hotel",
  keyOf: hotelKey,
  toJson: (row) => row,
};

/** The Rooms template (Slice 3). */
export const ROOMS_IMPORT: ImportKindSpec<RoomImportRow> = {
  kind: "rooms",
  importType: "hotel_rooms",
  template: HOTEL_IMPORT_TEMPLATES.rooms,
  schema: roomImportRow,
  noun: "room",
  keyOf: childKey,
  toJson: (row) => row,
};

/** The Venues template (Slice 3). */
export const VENUES_IMPORT: ImportKindSpec<VenueImportRow> = {
  kind: "venues",
  importType: "hotel_venues",
  template: HOTEL_IMPORT_TEMPLATES.venues,
  schema: venueImportRow,
  noun: "venue",
  keyOf: childKey,
  toJson: (row) => row,
};

/**
 * A rates row names its hotel by web address, its card by name and its item by type, room and venue: the
 * item only when its type reads (the reader has turned the cell into a value), so a refused row's report
 * still says which item it was.
 */
function rateKey(values: Readonly<Record<string, unknown>>): ImportRowKey {
  const key = { slug: text(values["hotelSlug"]), name: text(values["cardName"]) };
  const itemType = hotelRateItemType.safeParse(values["itemType"]);
  if (!itemType.success) return key;
  const item = {
    itemType: itemType.data,
    roomName: text(values["roomName"]),
    venueName: text(values["venueName"]),
  };
  return { ...key, item };
}

/** The Rates template (Slice 4; D-184). */
export const RATES_IMPORT: ImportKindSpec<RateImportRow> = {
  kind: "rates",
  importType: "hotel_rates",
  template: HOTEL_IMPORT_TEMPLATES.rates,
  schema: rateImportRow,
  noun: "rate",
  keyOf: rateKey,
  toJson: (row) => row,
};
