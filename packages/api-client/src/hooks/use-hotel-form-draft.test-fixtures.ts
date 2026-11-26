import {
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_CAPS,
  HOTEL_FORM_DISPLAY_VERSION,
  hotelFormSectionVersionsOf,
  type HotelFormDraftView,
  type HotelFormMe,
} from "@ampm/core";

/*
 * Synthetic data for the hotel form's draft hooks' tests (D-190 §3): a form session, a draft with one
 * colleague's saved section, the signed-in person, a submit's body and a colleague's newer save.
 */

export const SESSION = `hfs_${"B".repeat(43)}`;
export const AT = "2026-11-26T09:30:00.000Z";
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
export const DRAFT: HotelFormDraftView = {
  request: {
    reference: "HIR-2026-0042",
    kind: "onboarding",
    status: "open",
    state: "ready",
    displayLabel: "Synthetic Lake Palace, winter 2026",
    staffNote: null,
    expiresAt: "2026-12-26T00:00:00.000Z",
    submittedAt: null,
    submittedBy: null,
  },
  sections: {
    property: unsaved,
    contact: unsaved,
    rooms: {
      ...unsaved,
      answers: { totalRooms: 30 },
      version: 2,
      lastEditedBy: "Colleague",
      lastEditedAt: AT,
    },
    venues: unsaved,
    booking_terms: unsaved,
    food_beverage: unsaved,
    fact_sheet_media: { ...unsaved, isComplete: true },
  },
  contributors: [{ fullName: "Synthetic Person", designation: "General Manager", isYou: true }],
  caps: HOTEL_FORM_CAPS,
  options: {
    cuisines: { options: ["Indian"], other: "Other" },
    facilities: { options: ["Spa"], other: "Other" },
  },
  readAt: "2026-11-26T09:31:00.000Z",
};
export const ME: HotelFormMe = {
  personId: "0192f3a0-7d3e-7b1a-9c2f-0000000000a5",
  person: { fullName: "Synthetic Person", designation: "General Manager" },
  request: {
    displayLabel: null,
    staffNote: null,
    status: "open",
    expiresAt: "2026-12-26T00:00:00.000Z",
  },
};
export const SUBMIT = {
  accuracy: { accepted: true as const, textVersion: HOTEL_FORM_ACCURACY_VERSION },
  display: { answer: "yes" as const, textVersion: HOTEL_FORM_DISPLAY_VERSION },
  sectionVersions: hotelFormSectionVersionsOf(DRAFT.sections),
  botToken: "turnstile-pass",
};

/** A colleague's newer save of the rooms section, as a 409 carries it. */
export const THEIRS = {
  section: "rooms" as const,
  version: 4,
  answers: { totalRooms: 44 },
  noChanges: false,
  editedBy: "Colleague",
  editedAt: AT,
};
