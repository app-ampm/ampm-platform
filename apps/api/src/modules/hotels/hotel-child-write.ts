import {
  isIndoorSetting,
  ROOM_AREA_PAIRS,
  VENUE_AREA_PAIRS,
  type RoomCategoryCreateRequest,
  type RoomCategoryUpdateRequest,
  type VenueCreateRequest,
  type VenueUpdateRequest,
} from "@ampm/core";

import { settleAreas } from "./hotel-areas.js";

/*
 * How a staff request or an import row becomes the columns written to a room category or a venue (D-178).
 * Pure, one rule for both paths: the units rule settles each area pair (a filled sq ft gives its m²; an m²
 * written alone on a row that stores sq ft clears the sq ft), and a venue's setting decides `is_indoor`,
 * which no request carries: true only for indoor. A field left undefined is not written.
 */

/** A room's sq ft as stored: what the units rule of an update reads. */
export interface StoredRoomArea {
  readonly sizeSqft: number | null;
}

/** A venue's sq ft figures as stored: what the units rule of an update reads. */
export interface StoredVenueAreas {
  readonly areaSqft: number | null;
  readonly prefunctionAreaSqft: number | null;
}

/** A new venue's columns: the request's fields and the `is_indoor` its setting gives. */
export type VenueWriteData = VenueCreateRequest & { readonly isIndoor: boolean };

/** A venue update's columns: `is_indoor` moves only with the setting. */
export type VenuePatchData = VenueUpdateRequest & { readonly isIndoor?: boolean };

/**
 * A new room's columns.
 *
 * @example
 * roomCreateData({ name: "Synthetic Villa", sizeSqft: 850 }); // { name, sizeSqft: 850, sizeSqm: 79 }
 */
export function roomCreateData(request: RoomCategoryCreateRequest): RoomCategoryCreateRequest {
  return settleAreas(request, ROOM_AREA_PAIRS, null);
}

/**
 * A room update's columns, read against the sq ft the room stores.
 *
 * @example
 * roomPatchData({ sizeSqm: 40 }, { sizeSqft: 500 }); // { sizeSqm: 40, sizeSqft: null }
 */
export function roomPatchData(
  patch: RoomCategoryUpdateRequest,
  stored: StoredRoomArea,
): RoomCategoryUpdateRequest {
  return settleAreas(patch, ROOM_AREA_PAIRS, stored);
}

/**
 * A new venue's columns: its areas settled and `is_indoor` from its setting.
 *
 * @example
 * venueCreateData({ name: "Synthetic Terrace", venueType: "terrace", setting: "semi_open" }).isIndoor; // false
 */
export function venueCreateData(request: VenueCreateRequest): VenueWriteData {
  return {
    ...settleAreas(request, VENUE_AREA_PAIRS, null),
    isIndoor: isIndoorSetting(request.setting),
  };
}

/**
 * A venue update's columns, read against the sq ft it stores; a new setting moves `is_indoor` with it.
 *
 * @example
 * venuePatchData({ setting: "indoor" }, { areaSqft: null, prefunctionAreaSqft: null }); // { setting, isIndoor: true }
 */
export function venuePatchData(
  patch: VenueUpdateRequest,
  stored: StoredVenueAreas,
): VenuePatchData {
  const settled = settleAreas(patch, VENUE_AREA_PAIRS, stored);
  if (patch.setting === undefined) return settled;
  return { ...settled, isIndoor: isIndoorSetting(patch.setting) };
}
