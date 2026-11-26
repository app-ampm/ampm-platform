import { HOTEL_FORM_CAPS, type HotelFormDraftView } from "@ampm/core";

import type { DraftView } from "./use-hotel-form-flow";

/*
 * A hotel form's draft as `GET /hotel-form/draft` answers it (D-190 §3), synthetic, for the overview's and
 * the sections' tests. Imported by tests only.
 */

const unsaved = {
  answers: {},
  version: 0,
  isComplete: false,
  noChanges: false,
  lastEditedBy: null,
  lastEditedAt: null,
  isLastSaveYours: false,
  isUnreadable: false,
};

export const EDITED_AT = "2026-11-26T05:12:00.000Z";

export const DRAFT: HotelFormDraftView = {
  request: {
    reference: "HIR-2026-0042",
    kind: "onboarding",
    status: "open",
    state: "ready",
    displayLabel: "Seasonal refresh 2027",
    staffNote: "Please add the new banquet hall.",
    expiresAt: "2026-12-25T10:00:00.000Z",
    submittedAt: null,
    submittedBy: null,
  },
  sections: {
    property: {
      ...unsaved,
      answers: { name: "Synthetic Lake Palace", city: "Udaipur" },
      version: 3,
      isComplete: false,
      lastEditedBy: "Ravi Kumar",
      lastEditedAt: EDITED_AT,
    },
    contact: {
      ...unsaved,
      version: 2,
      isComplete: true,
      lastEditedBy: "Asha Rao",
      lastEditedAt: EDITED_AT,
      isLastSaveYours: true,
    },
    rooms: {
      ...unsaved,
      answers: { totalRooms: 40 },
      version: 2,
      lastEditedBy: "Ravi Kumar",
      lastEditedAt: EDITED_AT,
    },
    venues: unsaved,
    booking_terms: unsaved,
    food_beverage: unsaved,
    fact_sheet_media: { ...unsaved, isComplete: true },
  },
  contributors: [
    { fullName: "Asha Rao", designation: "General Manager", isYou: true },
    { fullName: "Ravi Kumar", designation: "Director of Sales", isYou: false },
  ],
  caps: HOTEL_FORM_CAPS,
  options: {
    cuisines: { options: ["Indian", "Continental", "Asian", "Italian"], other: "Other" },
    facilities: { options: ["Swimming pool", "Spa", "Gym"], other: "Other" },
  },
};

/** The draft as the flow holds it: read, with nothing failing. */
export function draftView(draft: HotelFormDraftView | undefined = DRAFT): DraftView {
  return { data: draft, isLoading: false, error: null, retry: () => undefined };
}

/** The draft with its request moved on (submitted, in review, changes requested, merged). */
export function draftWith(request: Partial<HotelFormDraftView["request"]>): HotelFormDraftView {
  return { ...DRAFT, request: { ...DRAFT.request, ...request } };
}
