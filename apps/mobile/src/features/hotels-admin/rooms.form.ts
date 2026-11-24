import type {
  HotelRoomUnitType,
  RoomCategoryCreateRequest,
  RoomCategoryUpdateRequest,
  RoomCategoryView,
} from "@ampm/core";

import { areaBody, areaErrors, ROOM_SIZE_AREA } from "./hotel-area.form";
import {
  changedEntries,
  facilitiesError,
  intOrNull,
  linesToList,
  listToLines,
  numberRuleError,
  numberToText,
  textOrNull,
  type NumberRule,
} from "./hotel-form-fields";

/*
 * The room category editor's form logic (TW-22; D-178), pure so it is tested without rendering: the
 * draft (text as strings), the checks that must pass before a save, and the create body and an update's
 * changed part. The server re-validates every bound and works the m² out from a filled sq ft again.
 */

/** A room category's unit type as the picker holds it: one of core's, or "unset" (not stated, null). */
export type UnitTypeChoice = HotelRoomUnitType | "unset";

export interface RoomDraft {
  readonly name: string;
  readonly unitType: UnitTypeChoice;
  readonly viewLabel: string;
  readonly bedConfiguration: string;
  readonly roomCount: string;
  readonly maxOccupancy: string;
  readonly sizeSqm: string;
  readonly sizeSqft: string;
  /** One per line, as the import's list rule reads them (a comma stays inside an entry). */
  readonly facilities: string;
  readonly description: string;
}

export function draftFromRoom(room: RoomCategoryView | null): RoomDraft {
  return {
    name: room?.name ?? "",
    unitType: room?.unitType ?? "unset",
    viewLabel: room?.viewLabel ?? "",
    bedConfiguration: room?.bedConfiguration ?? "",
    roomCount: numberToText(room?.roomCount ?? null),
    maxOccupancy: numberToText(room?.maxOccupancy ?? null),
    sizeSqm: numberToText(room?.sizeSqm ?? null),
    sizeSqft: numberToText(room?.sizeSqft ?? null),
    facilities: listToLines(room?.facilities ?? null),
    description: room?.description ?? "",
  };
}

/** The fields the checks name, in the order the editor shows them (a blocked save focuses the first). */
export const ROOM_FIELD_ORDER = [
  "name",
  "roomCount",
  "maxOccupancy",
  "sizeSqm",
  "sizeSqft",
  "facilities",
] as const satisfies readonly (keyof RoomDraft)[];
export type RoomField = (typeof ROOM_FIELD_ORDER)[number];

/** Each checked field's label as the editor shows it. */
export const ROOM_FIELD_LABEL: Readonly<Record<RoomField, string>> = {
  name: "Name",
  roomCount: "Number of rooms",
  maxOccupancy: "Max occupancy",
  sizeSqm: "Size (m²)",
  sizeSqft: "Size (sq ft)",
  facilities: "Facilities",
};

export type RoomErrors = Readonly<Record<RoomField, string | undefined>>;

const ROOM_COUNT_RULE: NumberRule = {
  min: 0,
  max: 100_000,
  places: 0,
  message: "Rooms is a whole number, up to 100,000",
};

const MAX_OCCUPANCY_RULE: NumberRule = {
  min: 1,
  max: 100,
  places: 0,
  message: "Max occupancy is a whole number from 1 to 100",
};

export function validateRoom(draft: RoomDraft): RoomErrors {
  const size = areaErrors(draft.sizeSqm, draft.sizeSqft, ROOM_SIZE_AREA);
  return {
    name: draft.name.trim() === "" ? "Give the room category a name" : undefined,
    roomCount: numberRuleError(draft.roomCount, ROOM_COUNT_RULE),
    maxOccupancy: numberRuleError(draft.maxOccupancy, MAX_OCCUPANCY_RULE),
    sizeSqm: size.sqm,
    sizeSqft: size.sqft,
    facilities: facilitiesError(draft.facilities),
  };
}

/**
 * The create body from a valid draft: trimmed text or null, "Not set" as null, facilities one per line
 * (a "|" also separating two), and the m² worked out from a filled sq ft.
 */
export function buildRoomBody(draft: RoomDraft): RoomCategoryCreateRequest {
  const size = areaBody(draft.sizeSqm, draft.sizeSqft);
  return {
    name: draft.name.trim(),
    unitType: draft.unitType === "unset" ? null : draft.unitType,
    viewLabel: textOrNull(draft.viewLabel),
    bedConfiguration: textOrNull(draft.bedConfiguration),
    roomCount: intOrNull(draft.roomCount),
    maxOccupancy: intOrNull(draft.maxOccupancy),
    sizeSqm: size.sqm,
    sizeSqft: size.sqft,
    facilities: linesToList(draft.facilities),
    description: textOrNull(draft.description),
  };
}

/**
 * An update's body: only what the draft changes from the room category as the sheet opened it, so a save
 * never writes back a value an import changed meanwhile. Empty when nothing changed.
 *
 * @example
 * roomUpdateBody({ ...draftFromRoom(room), roomCount: "25" }, room); // { roomCount: 25 }
 */
export function roomUpdateBody(
  draft: RoomDraft,
  room: RoomCategoryView,
): RoomCategoryUpdateRequest {
  return changedEntries(buildRoomBody(draft), buildRoomBody(draftFromRoom(room)));
}
