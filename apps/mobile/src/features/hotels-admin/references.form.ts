import type { WeddingReferenceCreateRequest, WeddingReferenceView } from "@ampm/core";

import { intOrNull, numberToText, textOrNull, wholeNumberError } from "./hotel-form-fields";

/*
 * The reference editor's draft (TW-22 References): the text the form holds, its validation and the
 * request it builds. Visibility and consent are not here: consent arrives by upload and showing a
 * reference to clients is its own action on the row (GP-20). No rendering, no I/O.
 */

/** The field matrix's bounds (C, hotel_wedding_references), as the contract enforces them. */
const EVENT_YEAR_MIN = 1900;
const EVENT_YEAR_MAX = 2100;
const DESCRIPTION_MAX = 10_000;

export interface ReferenceDraft {
  readonly eventYear: string;
  readonly guestCount: string;
  readonly descriptionClient: string;
}

export type ReferenceErrors = {
  readonly [K in keyof ReferenceDraft]: string | undefined;
};

export function draftFromReference(reference: WeddingReferenceView | null): ReferenceDraft {
  return {
    eventYear: reference ? String(reference.eventYear) : "",
    guestCount: numberToText(reference?.guestCount ?? null),
    descriptionClient: reference?.descriptionClient ?? "",
  };
}

function eventYearError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return "Enter the year of the wedding";
  const year = Number(trimmed);
  if (!/^\d{4}$/.test(trimmed) || year < EVENT_YEAR_MIN || year > EVENT_YEAR_MAX) {
    return "Enter a four-digit year, e.g. 2024";
  }
  return undefined;
}

export function validateReference(draft: ReferenceDraft): ReferenceErrors {
  return {
    eventYear: eventYearError(draft.eventYear),
    guestCount: wholeNumberError(draft.guestCount, "Guests"),
    descriptionClient:
      draft.descriptionClient.trim().length > DESCRIPTION_MAX
        ? `Keep the description under ${DESCRIPTION_MAX.toLocaleString("en-IN")} characters`
        : undefined,
  };
}

/** The body for create, and for an edit (the same three fields; the server keeps visibility as is). */
export function buildReferenceBody(
  draft: ReferenceDraft,
): Omit<WeddingReferenceCreateRequest, "clientVisible"> {
  return {
    eventYear: Number(draft.eventYear.trim()),
    guestCount: intOrNull(draft.guestCount),
    descriptionClient: textOrNull(draft.descriptionClient),
  };
}
