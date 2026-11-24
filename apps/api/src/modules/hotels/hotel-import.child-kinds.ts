import {
  isIndoorSetting,
  ROOM_AREA_PAIRS,
  ROOM_IMPORT_COLUMNS,
  ROOM_IMPORT_COMPARED_FIELDS,
  VENUE_AREA_PAIRS,
  VENUE_IMPORT_COLUMNS,
  VENUE_IMPORT_COMPARED_FIELDS,
  type HotelFieldValues,
  type RoomCategoryCreateRequest,
  type RoomCategoryUpdateRequest,
  type RoomImportComparedField,
  type RoomImportRow,
  type VenueImportComparedField,
  type VenueImportRow,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { venueCreateData, type VenuePatchData, type VenueWriteData } from "./hotel-child-write.js";
import type { ChildCreate, ChildPlanRules } from "./hotel-import.child-plan.js";
import { ROOMS_IMPORT, VENUES_IMPORT, type ImportKindSpec } from "./hotel-import.kinds.js";
import type { FieldError } from "./hotel-import.plan.js";
import type { HotelImportRepository } from "./hotel-import.repository.js";
import { roomVersion, venueVersion } from "./hotel-import.version.js";
import type {
  HotelSubresourcesRepository,
  RoomRow,
  VenueRow,
} from "./hotel-subresources.repository.js";
import { toRoomCategoryView, toVenueView } from "./hotels-admin.view.js";

/*
 * The Rooms and Venues kinds of the staff import (D-178, D-181): what each plans with (its compared fields,
 * area pairs, what a new row needs, how a change is written) and how it reads, locks and writes its stored
 * rows. The rows are written as the staff routes write them (hotel-child-write.ts): a venue's setting
 * decides `is_indoor`. A preview settles the units rule on the whole row before it picks the changed
 * fields, so an import's patch is never settled again: a changed m² alone must not clear a kept sq ft.
 */

/** One kind of child row end to end: its plan rules, and its reads, locks and writes. */
export interface ChildKindRules<
  Row,
  K extends string,
  Create,
  Patch,
  Stored,
> extends ChildPlanRules<Row, K, Create, Patch> {
  readonly spec: ImportKindSpec<Row>;
  readonly entityType: "hotel_room_category" | "hotel_venue";
  findLive(
    imports: HotelImportRepository,
    hotelIds: readonly string[],
    tx?: Prisma.TransactionClient,
  ): Promise<Stored[]>;
  lockLive(
    imports: HotelImportRepository,
    hotelIds: readonly string[],
    tx: Prisma.TransactionClient,
  ): Promise<void>;
  /** A stored row's id, hotel and name. */
  keyOf(stored: Stored): { readonly id: string; readonly hotelId: string; readonly name: string };
  /** A stored row's compared values, as the staff view reads them. */
  valuesOf(stored: Stored): HotelFieldValues<K>;
  versionOf(stored: Stored): string;
  create(
    repo: HotelSubresourcesRepository,
    hotelId: string,
    data: Create,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ readonly id: string }>;
  update(
    repo: HotelSubresourcesRepository,
    id: string,
    patch: Patch,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<unknown>;
}

const ROOM_COMPARED = ROOM_IMPORT_COLUMNS.filter(
  (column): column is RoomImportComparedField => column !== "hotelSlug" && column !== "name",
);

/** A matched room's changed columns: the settled row's values of the fields it changes, nothing else. */
function roomPatch(
  row: RoomImportRow,
  changed: readonly RoomImportComparedField[],
): RoomCategoryUpdateRequest {
  const keep = new Set<string>(changed);
  const patch: RoomCategoryUpdateRequest = {
    roomCount: row.roomCount,
    unitType: row.unitType,
    viewLabel: row.viewLabel,
    bedConfiguration: row.bedConfiguration,
    maxOccupancy: row.maxOccupancy,
    sizeSqm: row.sizeSqm,
    sizeSqft: row.sizeSqft,
    facilities: row.facilities,
    description: row.description,
  };
  for (const key of ROOM_COMPARED) if (!keep.has(key)) delete patch[key];
  return patch;
}

/** The Rooms kind. */
export const ROOM_KIND: ChildKindRules<
  RoomImportRow,
  RoomImportComparedField,
  RoomCategoryCreateRequest,
  RoomCategoryUpdateRequest,
  RoomRow
> = {
  spec: ROOMS_IMPORT,
  entityType: "hotel_room_category",
  noun: "room",
  plural: "rooms",
  fields: ROOM_IMPORT_COMPARED_FIELDS,
  areas: ROOM_AREA_PAIRS,
  scales: {},
  toCreate: ({ hotelSlug: _hotelSlug, ...fields }) => ({ data: fields }),
  toPatch: roomPatch,
  filled: (row) =>
    ROOM_IMPORT_COLUMNS.filter((column) => column !== "hotelSlug" && row[column] !== undefined),
  findLive: (imports, hotelIds, tx) => imports.findLiveRooms(hotelIds, tx),
  lockLive: (imports, hotelIds, tx) => imports.lockLiveRooms(hotelIds, tx),
  keyOf: ({ id, hotelId, name }) => ({ id, hotelId, name }),
  valuesOf: toRoomCategoryView,
  versionOf: roomVersion,
  create: (repo, hotelId, data, actorId, tx) => repo.createRoom(hotelId, data, actorId, tx),
  update: (repo, id, patch, actorId, tx) => repo.updateRoom(id, patch, actorId, tx),
};

const VENUE_COMPARED = VENUE_IMPORT_COLUMNS.filter(
  (column): column is VenueImportComparedField => column !== "hotelSlug" && column !== "name",
);

/** A new venue needs its type and setting: without them the row is refused, never a database error. */
function venueCreate(row: VenueImportRow): ChildCreate<VenueWriteData> {
  const { hotelSlug: _hotelSlug, venueType, setting, ...fields } = row;
  const errors: FieldError[] = [];
  if (venueType === undefined) {
    errors.push({ field: "venueType", message: "A new venue needs its venue type" });
  }
  if (setting === undefined) {
    errors.push({
      field: "setting",
      message: "A new venue needs its setting: indoor, outdoor or semi_open",
    });
  }
  if (venueType === undefined || setting === undefined) return { errors };
  return { data: venueCreateData({ ...fields, venueType, setting }) };
}

/** A matched venue's changed columns; a changed setting moves `is_indoor` with it. */
function venuePatch(
  row: VenueImportRow,
  changed: readonly VenueImportComparedField[],
): VenuePatchData {
  const keep = new Set<string>(changed);
  const patch: VenuePatchData = {
    venueType: row.venueType,
    setting: row.setting,
    areaSqm: row.areaSqm,
    areaSqft: row.areaSqft,
    lengthM: row.lengthM,
    widthM: row.widthM,
    ceilingHeightM: row.ceilingHeightM,
    capacityBanquet: row.capacityBanquet,
    capacityTheatre: row.capacityTheatre,
    capacityReception: row.capacityReception,
    otherLayouts: row.otherLayouts,
    prefunctionAreaSqm: row.prefunctionAreaSqm,
    prefunctionAreaSqft: row.prefunctionAreaSqft,
    capacityNotes: row.capacityNotes,
    facilities: row.facilities,
    description: row.description,
  };
  for (const key of VENUE_COMPARED) if (!keep.has(key)) delete patch[key];
  return patch.setting === undefined
    ? patch
    : { ...patch, isIndoor: isIndoorSetting(patch.setting) };
}

/** The Venues kind. */
export const VENUE_KIND: ChildKindRules<
  VenueImportRow,
  VenueImportComparedField,
  VenueWriteData,
  VenuePatchData,
  VenueRow
> = {
  spec: VENUES_IMPORT,
  entityType: "hotel_venue",
  noun: "venue",
  plural: "venues",
  fields: VENUE_IMPORT_COMPARED_FIELDS,
  areas: VENUE_AREA_PAIRS,
  // numeric(6,2): the metres a venue keeps, so 30.000000000000004 compares and writes as 30.
  scales: { lengthM: 2, widthM: 2, ceilingHeightM: 2 },
  toCreate: venueCreate,
  toPatch: venuePatch,
  filled: (row) =>
    VENUE_IMPORT_COLUMNS.filter((column) => column !== "hotelSlug" && row[column] !== undefined),
  findLive: (imports, hotelIds, tx) => imports.findLiveVenues(hotelIds, tx),
  lockLive: (imports, hotelIds, tx) => imports.lockLiveVenues(hotelIds, tx),
  keyOf: ({ id, hotelId, name }) => ({ id, hotelId, name }),
  valuesOf: toVenueView,
  versionOf: venueVersion,
  create: (repo, hotelId, data, actorId, tx) => repo.createVenue(hotelId, data, actorId, tx),
  update: (repo, id, patch, actorId, tx) => repo.updateVenue(id, patch, actorId, tx),
};
