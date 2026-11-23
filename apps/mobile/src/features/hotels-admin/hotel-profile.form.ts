import type {
  HotelCreateRequest,
  HotelStaffListItem,
  HotelStaffNotesView,
  HotelStatus,
} from "@ampm/core";

import {
  facilitiesToText,
  intOrNull,
  isWholeNumber,
  numberToText,
  textOrNull,
  textToFacilities,
} from "./hotel-form-fields";

export { hasErrors } from "./hotel-form-fields";

/*
 * The hotel profile editor's form logic (H1.1b), kept pure so it is tested without rendering: the
 * draft the form holds (text as strings), the client-side checks that must pass before submit, and the
 * create/update body built from a valid draft. The server re-validates every field (bounds, URL,
 * slug uniqueness, that the destination exists) and is the authority. Latitude/longitude/streetViewRef
 * are deferred to a later slice, so they are left unchanged by this editor. The internal rating and
 * notes are RESTRICTED-NOTES: a hotel carries them only for a reader of them, and they go in the body
 * only from someone who may set them (D-171), so nobody else's save can wipe them.
 */

export interface HotelProfileDraft {
  readonly destinationId: string;
  readonly name: string;
  readonly brand: string;
  readonly starCategory: string;
  readonly address: string;
  readonly website: string;
  readonly descriptionClient: string;
  readonly facilities: string;
  readonly totalRooms: string;
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

/** Edit seeds from the hotel's current profile; create starts empty with the draft status. */
export function draftFromHotel(hotel: HotelStaffListItem | null): HotelProfileDraft {
  const notes = hotel && hasInternalNotes(hotel) ? hotel : null;
  return {
    destinationId: hotel?.destinationId ?? "",
    name: hotel?.name ?? "",
    brand: hotel?.brand ?? "",
    starCategory: hotel?.starCategory ?? "",
    address: hotel?.address ?? "",
    website: hotel?.website ?? "",
    descriptionClient: hotel?.descriptionClient ?? "",
    facilities: facilitiesToText(hotel?.facilities ?? null),
    totalRooms: numberToText(hotel?.totalRooms ?? null),
    status: hotel?.status ?? "draft",
    demoVisible: hotel?.demoVisible ?? false,
    publicShowcase: hotel?.publicShowcase ?? false,
    internalRating: numberToText(notes?.internalRating ?? null),
    internalNotes: notes?.internalNotes ?? "",
  };
}

export type HotelProfileErrors = {
  readonly name: string | undefined;
  readonly destinationId: string | undefined;
  readonly totalRooms: string | undefined;
  readonly internalRating: string | undefined;
};

function ratingError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const ok = isWholeNumber(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= 5;
  return ok ? undefined : "Rating is 1 to 5";
}

/** Client-side checks that must pass before submit; the server re-validates bounds, URL and the slug. */
export function validateDraft(draft: HotelProfileDraft): HotelProfileErrors {
  return {
    name: draft.name.trim() === "" ? "Give the hotel a name" : undefined,
    destinationId: draft.destinationId === "" ? "Choose a destination" : undefined,
    totalRooms:
      draft.totalRooms.trim() !== "" && !isWholeNumber(draft.totalRooms)
        ? "Rooms must be a whole number"
        : undefined,
    internalRating: ratingError(draft.internalRating),
  };
}

/**
 * The request body from a valid draft: trimmed text or null for empties, parsed numbers. slug is
 * omitted (the server derives it from the name on create, and it is immutable after). The same shape
 * serves create and the partial update — every edited field is sent, and the server patches what changed.
 * The internal rating and notes are left out: {@link internalNotesBody} adds them for someone who may.
 */
export function buildHotelBody(draft: HotelProfileDraft): HotelCreateRequest {
  return {
    destinationId: draft.destinationId,
    name: draft.name.trim(),
    brand: textOrNull(draft.brand),
    starCategory: textOrNull(draft.starCategory),
    address: textOrNull(draft.address),
    website: textOrNull(draft.website),
    descriptionClient: textOrNull(draft.descriptionClient),
    facilities: textToFacilities(draft.facilities),
    totalRooms: intOrNull(draft.totalRooms),
    status: draft.status,
    demoVisible: draft.demoVisible,
    publicShowcase: draft.publicShowcase,
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
