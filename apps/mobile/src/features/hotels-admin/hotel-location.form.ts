import {
  isGoogleMapsUrl,
  postalCodeProblem,
  type HotelCreateRequest,
  type HotelStaffListItem,
} from "@ampm/core";

import {
  numberOrNull,
  numberRuleError,
  numberToText,
  textOrNull,
  type NumberRule,
} from "./hotel-form-fields";

/*
 * The profile editor's location and access part (D-178): where the hotel is (address, locality, city,
 * state, PIN code, its Google Maps link and coordinates) and how guests reach it (the airport, the railway
 * station and the city centre, each a distance in km and a drive in minutes). Text as strings; the checks
 * mirror the contract's bounds so a save is refused here, field by field, before the server says so. The
 * server stays the authority, the PIN rule included.
 */

export interface LocationDraft {
  readonly address: string;
  readonly locality: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly mapsUrl: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly airportName: string;
  readonly airportDistanceKm: string;
  readonly airportDriveMinutes: string;
  readonly railwayStationName: string;
  readonly railwayDistanceKm: string;
  readonly railwayDriveMinutes: string;
  readonly cityCentreDistanceKm: string;
  readonly cityCentreDriveMinutes: string;
  readonly accessNotes: string;
}

/** Edit seeds from the hotel; create starts empty. Numbers render as text. */
export function locationDraftFrom(hotel: HotelStaffListItem | null): LocationDraft {
  return {
    address: hotel?.address ?? "",
    locality: hotel?.locality ?? "",
    city: hotel?.city ?? "",
    state: hotel?.state ?? "",
    postalCode: hotel?.postalCode ?? "",
    mapsUrl: hotel?.mapsUrl ?? "",
    latitude: numberToText(hotel?.latitude ?? null),
    longitude: numberToText(hotel?.longitude ?? null),
    airportName: hotel?.airportName ?? "",
    airportDistanceKm: numberToText(hotel?.airportDistanceKm ?? null),
    airportDriveMinutes: numberToText(hotel?.airportDriveMinutes ?? null),
    railwayStationName: hotel?.railwayStationName ?? "",
    railwayDistanceKm: numberToText(hotel?.railwayDistanceKm ?? null),
    railwayDriveMinutes: numberToText(hotel?.railwayDriveMinutes ?? null),
    cityCentreDistanceKm: numberToText(hotel?.cityCentreDistanceKm ?? null),
    cityCentreDriveMinutes: numberToText(hotel?.cityCentreDriveMinutes ?? null),
    accessNotes: hotel?.accessNotes ?? "",
  };
}

export type LocationErrors = {
  readonly postalCode: string | undefined;
  readonly mapsUrl: string | undefined;
  readonly latitude: string | undefined;
  readonly longitude: string | undefined;
  readonly airportDistanceKm: string | undefined;
  readonly airportDriveMinutes: string | undefined;
  readonly railwayDistanceKm: string | undefined;
  readonly railwayDriveMinutes: string | undefined;
  readonly cityCentreDistanceKm: string | undefined;
  readonly cityCentreDriveMinutes: string | undefined;
};

/** A distance as the contract keeps it: km from 0 to 999.9, one decimal at most. */
function distanceRule(label: string): NumberRule {
  return {
    min: 0,
    max: 999.9,
    places: 1,
    message: `${label} is in km, from 0 to 999.9, with one decimal at most`,
  };
}

/** A drive as the contract keeps it: whole minutes from 0 to 600. */
function minutesRule(label: string): NumberRule {
  return { min: 0, max: 600, places: 0, message: `${label} is whole minutes, from 0 to 600` };
}

/** Coordinates keep six decimals (Decimal(9, 6)), so more would be rounded away on save. */
function coordinateRule(label: string, limit: number): NumberRule {
  return {
    min: -limit,
    max: limit,
    places: 6,
    message: `${label} is a number from -${limit} to ${limit}, with up to 6 decimals`,
  };
}

/** The longest postal code the contract takes. */
const POSTAL_CODE_MAX = 16;

function postalCodeError(value: string, country: string | null): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > POSTAL_CODE_MAX) {
    return `A PIN code is at most ${POSTAL_CODE_MAX} characters`;
  }
  return postalCodeProblem(country, trimmed) ?? undefined;
}

function mapsUrlError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "" || isGoogleMapsUrl(trimmed)) return undefined;
  return "Use an https Google Maps link (google.com/maps or maps.app.goo.gl)";
}

/**
 * The location checks. `country` is the chosen destination's, when known: an Indian PIN is six digits
 * not starting with 0; with no country the server decides.
 */
export function validateLocation(draft: LocationDraft, country: string | null): LocationErrors {
  return {
    postalCode: postalCodeError(draft.postalCode, country),
    mapsUrl: mapsUrlError(draft.mapsUrl),
    latitude: numberRuleError(draft.latitude, coordinateRule("Latitude", 90)),
    longitude: numberRuleError(draft.longitude, coordinateRule("Longitude", 180)),
    airportDistanceKm: numberRuleError(draft.airportDistanceKm, distanceRule("Airport distance")),
    airportDriveMinutes: numberRuleError(draft.airportDriveMinutes, minutesRule("Airport drive")),
    railwayDistanceKm: numberRuleError(
      draft.railwayDistanceKm,
      distanceRule("Railway station distance"),
    ),
    railwayDriveMinutes: numberRuleError(
      draft.railwayDriveMinutes,
      minutesRule("Railway station drive"),
    ),
    cityCentreDistanceKm: numberRuleError(
      draft.cityCentreDistanceKm,
      distanceRule("City centre distance"),
    ),
    cityCentreDriveMinutes: numberRuleError(
      draft.cityCentreDriveMinutes,
      minutesRule("City centre drive"),
    ),
  };
}

type LocationBody = Pick<
  HotelCreateRequest,
  | "address"
  | "locality"
  | "city"
  | "state"
  | "postalCode"
  | "mapsUrl"
  | "latitude"
  | "longitude"
  | "airportName"
  | "airportDistanceKm"
  | "airportDriveMinutes"
  | "railwayStationName"
  | "railwayDistanceKm"
  | "railwayDriveMinutes"
  | "cityCentreDistanceKm"
  | "cityCentreDriveMinutes"
  | "accessNotes"
>;

/** The location part of the body from a valid draft: trimmed text or null, parsed numbers. */
export function locationBody(draft: LocationDraft): LocationBody {
  return {
    address: textOrNull(draft.address),
    locality: textOrNull(draft.locality),
    city: textOrNull(draft.city),
    state: textOrNull(draft.state),
    postalCode: textOrNull(draft.postalCode),
    mapsUrl: textOrNull(draft.mapsUrl),
    latitude: numberOrNull(draft.latitude),
    longitude: numberOrNull(draft.longitude),
    airportName: textOrNull(draft.airportName),
    airportDistanceKm: numberOrNull(draft.airportDistanceKm),
    airportDriveMinutes: numberOrNull(draft.airportDriveMinutes),
    railwayStationName: textOrNull(draft.railwayStationName),
    railwayDistanceKm: numberOrNull(draft.railwayDistanceKm),
    railwayDriveMinutes: numberOrNull(draft.railwayDriveMinutes),
    cityCentreDistanceKm: numberOrNull(draft.cityCentreDistanceKm),
    cityCentreDriveMinutes: numberOrNull(draft.cityCentreDriveMinutes),
    accessNotes: textOrNull(draft.accessNotes),
  };
}
