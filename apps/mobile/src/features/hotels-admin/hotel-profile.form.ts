import type { HotelCreateRequest, HotelStaffView, HotelStatus } from "@ampm/core";

import { intOrNull, isWholeNumber, numberToText, textOrNull } from "./hotel-form-fields";

export { hasErrors } from "./hotel-form-fields";

/*
 * The hotel profile editor's form logic (H1.1b), kept pure so it is tested without rendering: the
 * draft the form holds (text as strings), the client-side checks that must pass before submit, and the
 * create/update body built from a valid draft. The server re-validates every field (bounds, URL,
 * slug uniqueness, that the destination exists) and is the authority. Latitude/longitude/streetViewRef
 * are deferred to a later slice, so they are left unchanged by this editor.
 */

export interface HotelProfileDraft {
  readonly destinationId: string;
  readonly name: string;
  readonly brand: string;
  readonly starCategory: string;
  readonly address: string;
  readonly website: string;
  readonly descriptionClient: string;
  readonly totalRooms: string;
  readonly status: HotelStatus;
  readonly demoVisible: boolean;
  readonly publicShowcase: boolean;
  readonly internalRating: string;
  readonly internalNotes: string;
}

/** Edit seeds from the hotel's current profile; create starts empty with the draft status. */
export function draftFromHotel(hotel: HotelStaffView | null): HotelProfileDraft {
  return {
    destinationId: hotel?.destinationId ?? "",
    name: hotel?.name ?? "",
    brand: hotel?.brand ?? "",
    starCategory: hotel?.starCategory ?? "",
    address: hotel?.address ?? "",
    website: hotel?.website ?? "",
    descriptionClient: hotel?.descriptionClient ?? "",
    totalRooms: numberToText(hotel?.totalRooms ?? null),
    status: hotel?.status ?? "draft",
    demoVisible: hotel?.demoVisible ?? false,
    publicShowcase: hotel?.publicShowcase ?? false,
    internalRating: numberToText(hotel?.internalRating ?? null),
    internalNotes: hotel?.internalNotes ?? "",
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
    totalRooms: intOrNull(draft.totalRooms),
    status: draft.status,
    demoVisible: draft.demoVisible,
    publicShowcase: draft.publicShowcase,
    internalRating: intOrNull(draft.internalRating),
    internalNotes: textOrNull(draft.internalNotes),
  };
}
