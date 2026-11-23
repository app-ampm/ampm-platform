import {
  HOTEL_NAME_ALIASES_MAX,
  type HotelCreateRequest,
  type HotelStaffListItem,
  type HotelStaffNotesView,
  type HotelStatus,
} from "@ampm/core";

import {
  bookingTermsBody,
  bookingTermsDraftFrom,
  validateBookingTerms,
  type BookingTermsDraft,
  type BookingTermsErrors,
} from "./hotel-booking-terms.form";
import {
  foodBody,
  foodDraftFrom,
  validateFood,
  type FoodDraft,
  type FoodErrors,
} from "./hotel-food.form";
import {
  intOrNull,
  isWholeNumber,
  linesToList,
  listToLines,
  numberOrNull,
  numberRuleError,
  numberToText,
  textOrNull,
} from "./hotel-form-fields";
import {
  locationBody,
  locationDraftFrom,
  validateLocation,
  type LocationDraft,
  type LocationErrors,
} from "./hotel-location.form";

export { hasErrors } from "./hotel-form-fields";

/*
 * The hotel profile editor's form logic (H1.1b, D-178), kept pure so it is tested without rendering:
 * the draft the form holds (text as strings), the client-side checks that must pass before submit, and
 * the create/update body built from a valid draft. The draft is the hotel's identity and details here,
 * plus the location and access, food and beverage, and booking terms parts, each in its own module. The
 * server re-validates every field (bounds, URL, the PIN rule, slug uniqueness, that the destination
 * exists) and is the authority. Latitude and longitude are edited here; streetViewRef stays untouched.
 * Every field the editor shows is seeded from the hotel and sent back, so a save never wipes one: the
 * INTERNAL name variants and booking terms ride the profile model every profile reader gets. The
 * internal rating and notes are RESTRICTED-NOTES: a hotel carries them only for a reader of them, and
 * they go in the body only from someone who may set them (D-171), so nobody else's save can wipe them.
 */

export interface HotelProfileDraft extends LocationDraft, FoodDraft, BookingTermsDraft {
  readonly destinationId: string;
  readonly name: string;
  readonly brand: string;
  readonly parentGroup: string;
  /** Other names the hotel goes by, one per line (INTERNAL). */
  readonly nameAliases: string;
  readonly starCategory: string;
  readonly website: string;
  readonly descriptionClient: string;
  /** The amenities, one per line, as the import's list rule reads them (a comma stays inside one). */
  readonly facilities: string;
  readonly totalRooms: string;
  readonly totalEventSpaceSqm: string;
  readonly totalEventSpaceSqft: string;
  readonly status: HotelStatus;
  readonly demoVisible: boolean;
  readonly publicShowcase: boolean;
  readonly internalRating: string;
  readonly internalNotes: string;
}

/**
 * Whether the hotel carries its internal rating and notes: only a reader of them gets them (D-171).
 *
 * @example
 * hasInternalNotes(hotel) ? hotel.internalNotes : undefined;
 */
export function hasInternalNotes(hotel: HotelStaffListItem): hotel is HotelStaffNotesView {
  return "internalRating" in hotel;
}

type IdentityDraft = Omit<
  HotelProfileDraft,
  | keyof LocationDraft
  | keyof FoodDraft
  | keyof BookingTermsDraft
  | "internalRating"
  | "internalNotes"
>;

function identityDraftFrom(hotel: HotelStaffListItem | null): IdentityDraft {
  return {
    destinationId: hotel?.destinationId ?? "",
    name: hotel?.name ?? "",
    brand: hotel?.brand ?? "",
    parentGroup: hotel?.parentGroup ?? "",
    nameAliases: listToLines(hotel?.nameAliases ?? null),
    starCategory: hotel?.starCategory ?? "",
    website: hotel?.website ?? "",
    descriptionClient: hotel?.descriptionClient ?? "",
    facilities: listToLines(hotel?.facilities ?? null),
    totalRooms: numberToText(hotel?.totalRooms ?? null),
    totalEventSpaceSqm: numberToText(hotel?.totalEventSpaceSqm ?? null),
    totalEventSpaceSqft: numberToText(hotel?.totalEventSpaceSqft ?? null),
    status: hotel?.status ?? "draft",
    demoVisible: hotel?.demoVisible ?? false,
    publicShowcase: hotel?.publicShowcase ?? false,
  };
}

/** Edit seeds from the hotel's current profile; create starts empty with the draft status. */
export function draftFromHotel(hotel: HotelStaffListItem | null): HotelProfileDraft {
  const notes = hotel && hasInternalNotes(hotel) ? hotel : null;
  return {
    ...identityDraftFrom(hotel),
    ...locationDraftFrom(hotel),
    ...foodDraftFrom(hotel),
    ...bookingTermsDraftFrom(hotel),
    internalRating: numberToText(notes?.internalRating ?? null),
    internalNotes: notes?.internalNotes ?? "",
  };
}

type IdentityErrors = {
  readonly name: string | undefined;
  readonly destinationId: string | undefined;
  readonly nameAliases: string | undefined;
  readonly totalRooms: string | undefined;
  readonly totalEventSpaceSqm: string | undefined;
  readonly totalEventSpaceSqft: string | undefined;
};

/** Every check's result, one key per field that can be wrong; undefined where it is fine. */
export type HotelProfileErrors = IdentityErrors &
  LocationErrors &
  FoodErrors &
  BookingTermsErrors & { readonly internalRating: string | undefined };

/** The longest name variant the contract takes. */
const NAME_ALIAS_MAX_LENGTH = 255;

function nameAliasesError(value: string): string | undefined {
  const aliases = linesToList(value) ?? [];
  if (aliases.length > HOTEL_NAME_ALIASES_MAX) {
    return `Keep to ${HOTEL_NAME_ALIASES_MAX} name variants, one per line`;
  }
  if (aliases.some((alias) => alias.length > NAME_ALIAS_MAX_LENGTH)) {
    return `Each name variant is at most ${NAME_ALIAS_MAX_LENGTH} characters`;
  }
  const distinct = new Set(aliases.map((alias) => alias.toLowerCase()));
  return distinct.size === aliases.length ? undefined : "Give each name variant once";
}

function validateIdentity(draft: IdentityDraft): IdentityErrors {
  return {
    name: draft.name.trim() === "" ? "Give the hotel a name" : undefined,
    destinationId: draft.destinationId === "" ? "Choose a destination" : undefined,
    nameAliases: nameAliasesError(draft.nameAliases),
    totalRooms: numberRuleError(draft.totalRooms, {
      min: 0,
      max: 100_000,
      places: 0,
      message: "Rooms must be a whole number, up to 100,000",
    }),
    totalEventSpaceSqm: numberRuleError(draft.totalEventSpaceSqm, {
      min: 0,
      max: 1_000_000,
      places: 0,
      message: "Event space in m² is a whole number, up to 1,000,000",
    }),
    totalEventSpaceSqft: numberRuleError(draft.totalEventSpaceSqft, {
      min: 0,
      max: 10_000_000,
      places: 0,
      message: "Event space in sq ft is a whole number, up to 10,000,000",
    }),
  };
}

function ratingError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const ok = isWholeNumber(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= 5;
  return ok ? undefined : "Rating is 1 to 5";
}

/**
 * Client-side checks that must pass before submit. `country` is the chosen destination's, when the
 * editor knows it (the PIN rule); the server re-validates every bound, the URL and the slug.
 */
export function validateDraft(
  draft: HotelProfileDraft,
  country: string | null = null,
): HotelProfileErrors {
  return {
    ...validateIdentity(draft),
    ...validateLocation(draft, country),
    ...validateFood(draft),
    ...validateBookingTerms(draft),
    internalRating: ratingError(draft.internalRating),
  };
}

/**
 * The request body from a valid draft: trimmed text or null for empties, parsed numbers, "not known"
 * and "not set" as null. slug is omitted (the server derives it from the name on create, and it is
 * immutable after), and so is streetViewRef. The same shape serves create and the partial update —
 * every edited field is sent, and the server patches what changed. The internal rating and notes are
 * left out: {@link internalNotesBody} adds them for someone who may.
 */
export function buildHotelBody(draft: HotelProfileDraft): HotelCreateRequest {
  return {
    destinationId: draft.destinationId,
    name: draft.name.trim(),
    brand: textOrNull(draft.brand),
    parentGroup: textOrNull(draft.parentGroup),
    nameAliases: linesToList(draft.nameAliases),
    starCategory: textOrNull(draft.starCategory),
    website: textOrNull(draft.website),
    descriptionClient: textOrNull(draft.descriptionClient),
    facilities: linesToList(draft.facilities),
    totalRooms: intOrNull(draft.totalRooms),
    totalEventSpaceSqm: numberOrNull(draft.totalEventSpaceSqm),
    totalEventSpaceSqft: numberOrNull(draft.totalEventSpaceSqft),
    status: draft.status,
    demoVisible: draft.demoVisible,
    publicShowcase: draft.publicShowcase,
    ...locationBody(draft),
    ...foodBody(draft),
    ...bookingTermsBody(draft),
  };
}

/**
 * The internal rating and notes of a valid draft, for a body from someone who may set them and, when
 * editing, read them. A body without them leaves them as they are; one with them from anyone else is
 * refused by the server (D-171).
 *
 * @example
 * const body = notesEditable ? { ...buildHotelBody(draft), ...internalNotesBody(draft) } : buildHotelBody(draft);
 */
export function internalNotesBody(
  draft: HotelProfileDraft,
): Pick<HotelCreateRequest, "internalRating" | "internalNotes"> {
  return {
    internalRating: intOrNull(draft.internalRating),
    internalNotes: textOrNull(draft.internalNotes),
  };
}
