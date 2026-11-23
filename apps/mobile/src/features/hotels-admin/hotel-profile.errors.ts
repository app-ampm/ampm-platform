import type { ToastOptions } from "@ampm/ui";

import type { HotelProfileErrors } from "./hotel-profile.form";

/*
 * Where the profile editor's errors sit. The sheet is one long column (a 512-wide dialog from 768), so an
 * error in a lower panel is out of sight when Save is pressed: the editor names the first one in a toast,
 * which carries its own live region, and moves focus to it. Pure, so the order is tested.
 */

/** A field that can be wrong. */
export type ProfileFieldKey = keyof HotelProfileErrors;

/** Each field's label as the editor shows it; one entry per key, so a new check cannot be missed. */
const FIELD_LABEL: Record<ProfileFieldKey, string> = {
  name: "Hotel name",
  destinationId: "Destination",
  nameAliases: "Name variants",
  totalRooms: "Total rooms",
  postalCode: "PIN code",
  mapsUrl: "Google Maps link",
  latitude: "Latitude",
  longitude: "Longitude",
  airportDistanceKm: "Airport distance (km)",
  airportDriveMinutes: "Airport drive (minutes)",
  railwayDistanceKm: "Railway station distance (km)",
  railwayDriveMinutes: "Railway station drive (minutes)",
  cityCentreDistanceKm: "City centre distance (km)",
  cityCentreDriveMinutes: "City centre drive (minutes)",
  totalEventSpaceSqm: "Total event space (m²)",
  totalEventSpaceSqft: "Total event space (sq ft)",
  cuisines: "Cuisines",
  minRoomsWithoutBuyout: "Minimum rooms without a buyout",
  minNights: "Minimum nights",
  internalRating: "Internal rating (1–5)",
};

/** The fields in the order the editor shows them, top to bottom. */
export const PROFILE_FIELD_ORDER: readonly ProfileFieldKey[] = [
  "name",
  "destinationId",
  "nameAliases",
  "totalRooms",
  "postalCode",
  "mapsUrl",
  "latitude",
  "longitude",
  "airportDistanceKm",
  "airportDriveMinutes",
  "railwayDistanceKm",
  "railwayDriveMinutes",
  "cityCentreDistanceKm",
  "cityCentreDriveMinutes",
  "totalEventSpaceSqm",
  "totalEventSpaceSqft",
  "cuisines",
  "minRoomsWithoutBuyout",
  "minNights",
  "internalRating",
];

/** A field's label as the editor shows it. */
export function profileFieldLabel(key: ProfileFieldKey): string {
  return FIELD_LABEL[key];
}

/** The highest field on the sheet with an error, or undefined when there is none. */
export function firstInvalidField(errors: HotelProfileErrors): ProfileFieldKey | undefined {
  return PROFILE_FIELD_ORDER.find((key) => errors[key] !== undefined);
}

/**
 * The toast for a save the checks blocked: it names the first field to fix and why, wherever it sits.
 *
 * @example
 * blockedSaveToast("mapsUrl", "Use an https Google Maps link");
 * // { title: "Check the highlighted fields", description: "Google Maps link: Use an https…", tone: "danger" }
 */
export function blockedSaveToast(key: ProfileFieldKey, message: string): ToastOptions {
  return {
    title: "Check the highlighted fields",
    description: `${profileFieldLabel(key)}: ${message}`,
    tone: "danger",
  };
}
