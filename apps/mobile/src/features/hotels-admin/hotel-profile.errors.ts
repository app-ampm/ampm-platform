import type { ErrorDetail } from "@ampm/core";
import type { ToastOptions } from "@ampm/ui";

import type { HotelProfileErrors } from "./hotel-profile.form";

/*
 * Where the profile editor's errors sit. The sheet is one long column (a 512-wide dialog from 768), so an
 * error in a lower panel is out of sight when Save is pressed: the editor names the first one in a toast,
 * which carries its own live region, and moves focus to it. A save the server refuses is shown the same
 * way, under the fields its errors name, for what the editor cannot check itself: a PIN sent before the
 * destination list loaded, a cuisine dropped from the options since they loaded, text over its length.
 * Pure, so the order and the placing are tested.
 */

/** The fields only the server checks: the editor sends them as typed. */
export const SERVER_CHECKED_FIELDS = [
  "website",
  "descriptionClient",
  "facilities",
  "internalNotes",
] as const;

/** A field that can be wrong: one the editor checks, or one only the server does. */
export type ProfileFieldKey = keyof HotelProfileErrors | (typeof SERVER_CHECKED_FIELDS)[number];

/** The errors on show, by field. */
export type ProfileFieldErrors = Partial<Record<ProfileFieldKey, string>>;

/** Each field's label as the editor shows it; one entry per key, so a new check cannot be missed. */
const FIELD_LABEL: Record<ProfileFieldKey, string> = {
  name: "Hotel name",
  destinationId: "Destination",
  nameAliases: "Name variants",
  totalRooms: "Total rooms",
  website: "Website",
  descriptionClient: "Client description",
  facilities: "Facilities",
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
  internalNotes: "Internal notes",
};

/** The fields in the order the editor shows them, top to bottom. */
export const PROFILE_FIELD_ORDER: readonly ProfileFieldKey[] = [
  "name",
  "destinationId",
  "nameAliases",
  "totalRooms",
  "website",
  "descriptionClient",
  "facilities",
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
  "internalNotes",
];

/** Whether a name is a field the editor shows an error under. */
function isProfileFieldKey(name: string): name is ProfileFieldKey {
  return PROFILE_FIELD_ORDER.some((key) => key === name);
}

/** A field's label as the editor shows it. */
export function profileFieldLabel(key: ProfileFieldKey): string {
  return FIELD_LABEL[key];
}

/** The highest field on the sheet with an error, or undefined when there is none. */
export function firstInvalidField(errors: ProfileFieldErrors): ProfileFieldKey | undefined {
  return PROFILE_FIELD_ORDER.find((key) => errors[key] !== undefined);
}

/**
 * The toast for a save the checks blocked or the server refused: it names the first field to fix and
 * why, wherever it sits.
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

/** A refused save's errors, placed under the editor's fields. */
export interface PlacedErrors {
  readonly fields: ProfileFieldErrors;
  /** Whether a detail names no field the editor shows (no path, or one it has no field for). */
  readonly unplaced: boolean;
}

/**
 * The details of a save the server refused, each under the field the first part of its path names
 * ("cuisines.2" is the cuisines), a field keeping its first message.
 *
 * @example
 * placeServerErrors([{ path: "cuisines.2", message: "Choose a cuisine from the list, or Other" }]);
 * // { fields: { cuisines: "Choose a cuisine from the list, or Other" }, unplaced: false }
 */
export function placeServerErrors(details: readonly ErrorDetail[]): PlacedErrors {
  const fields: ProfileFieldErrors = {};
  let unplaced = false;
  for (const { path, message } of details) {
    const key = path?.split(".")[0] ?? "";
    if (!isProfileFieldKey(key)) unplaced = true;
    else if (fields[key] === undefined) fields[key] = message;
  }
  return { fields, unplaced };
}

/**
 * The errors on show: a field's own check while it fails, else what the server said of it, so a check
 * the editor could not make (the PIN before the destination list loads) leaves the server's word.
 *
 * @example
 * errorsOnShow({}, { postalCode: "A PIN code is 6 digits" }); // { postalCode: "A PIN code is 6 digits" }
 */
export function errorsOnShow(
  checks: ProfileFieldErrors,
  server: ProfileFieldErrors,
): ProfileFieldErrors {
  const shown: ProfileFieldErrors = {};
  for (const key of PROFILE_FIELD_ORDER) {
    const message = checks[key] ?? server[key];
    if (message !== undefined) shown[key] = message;
  }
  return shown;
}

/**
 * The server's errors still standing once these draft fields change: an edited field's refusal is gone
 * until the next save checks it again.
 *
 * @example
 * withoutEdited({ postalCode: "…", cuisines: "…" }, ["postalCode"]); // { cuisines: "…" }
 */
export function withoutEdited(
  errors: ProfileFieldErrors,
  edited: readonly string[],
): ProfileFieldErrors {
  const left: ProfileFieldErrors = {};
  for (const key of PROFILE_FIELD_ORDER) {
    const message = errors[key];
    if (message !== undefined && !edited.includes(key)) left[key] = message;
  }
  return left;
}
