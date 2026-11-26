import { describe, expect, it } from "vitest";

import { AppError } from "../errors";
import { HOTEL_CUISINE_OTHER } from "./config";
import {
  HOTEL_FORM_CONFLICT_PATH,
  HOTEL_FORM_READ_ONLY_PATH,
  HOTEL_FORM_TOO_LARGE_PATH,
  hotelFormDraftView,
  hotelFormReadOnlyDetails,
  hotelFormReadOnlyOf,
  hotelFormSectionConflictDetails,
  hotelFormSectionConflictOf,
  hotelFormSectionParams,
  hotelFormSectionSaved,
  hotelFormSectionSaveRequest,
  hotelFormSectionTooLargeDetails,
  type HotelFormSectionConflict,
} from "./hotel-form-draft";
import { HOTEL_FACILITY_OPTIONS, HOTEL_FACILITY_OTHER } from "./hotel-form-options";
import { HOTEL_FORM_ERRORS } from "./hotel-form-refusals";
import { HOTEL_FORM_CAPS, HOTEL_FORM_SECTION_KEYS } from "./hotel-form-section-keys";
import { hotelFormMissingItemsOf } from "./hotel-form-submit";

/*
 * The draft's contracts (D-190 §3): `GET /hotel-form/draft`'s answer, a section's save and its answer,
 * and the two 409s' details (a colleague's newer save, a request no longer open to changes). Synthetic
 * data only.
 */

const at = "2026-11-26T09:30:00.000Z";
const unsaved = {
  answers: {},
  version: 0,
  isComplete: false,
  noChanges: false,
  lastEditedBy: null,
  lastEditedAt: null,
};

const sections = Object.fromEntries(HOTEL_FORM_SECTION_KEYS.map((key) => [key, unsaved]));

const draft = {
  request: {
    reference: "HIR-2026-0007",
    kind: "onboarding",
    status: "open",
    state: "ready",
    displayLabel: "Synthetic Lake Palace, winter 2026",
    staffNote: "Please start with the rooms.",
    expiresAt: "2026-12-26T00:00:00.000Z",
    submittedAt: null,
    submittedBy: null,
  },
  sections: {
    ...sections,
    property: {
      answers: { name: "Synthetic Lake Palace" },
      version: 3,
      isComplete: false,
      noChanges: false,
      lastEditedBy: "Synthetic Person",
      lastEditedAt: at,
    },
  },
  contributors: [
    { fullName: "Synthetic Person", designation: "General Manager", isYou: true },
    { fullName: "Synthetic Colleague", designation: "Sales Manager", isYou: false },
  ],
  caps: HOTEL_FORM_CAPS,
  options: {
    cuisines: { options: ["Indian", "Italian"], other: HOTEL_CUISINE_OTHER },
    facilities: { options: [...HOTEL_FACILITY_OPTIONS], other: HOTEL_FACILITY_OTHER },
  },
};

describe("hotelFormDraftView", () => {
  it("answers every section with its version, completeness, No changes and last editor", () => {
    const parsed = hotelFormDraftView.parse(draft);
    expect(Object.keys(parsed.sections)).toEqual([...HOTEL_FORM_SECTION_KEYS]);
    expect(parsed.sections.property).toMatchObject({
      version: 3,
      lastEditedBy: "Synthetic Person",
    });
    expect(parsed.sections.rooms).toEqual(unsaved);
  });

  it("holds the request's label, note, kind and state, the people helping, the caps and the options", () => {
    const parsed = hotelFormDraftView.parse(draft);
    expect(parsed.request).toMatchObject({
      kind: "onboarding",
      state: "ready",
      staffNote: "Please start with the rooms.",
    });
    expect(parsed.contributors).toHaveLength(2);
    expect(parsed.caps.roomRows).toBe(60);
    expect(parsed.options.facilities.other).toBe("Other");
  });

  it("refuses a section missing, an answer its draft refuses, a link that is not active, an extra key", () => {
    const six = Object.fromEntries(
      Object.entries(draft.sections).filter(([key]) => key !== "rooms"),
    );
    expect(hotelFormDraftView.safeParse({ ...draft, sections: six }).success).toBe(false);
    const bad = { ...draft.sections, rooms: { ...unsaved, answers: { rows: "many" } } };
    expect(hotelFormDraftView.safeParse({ ...draft, sections: bad }).success).toBe(false);
    const gone = { ...draft, request: { ...draft.request, state: "not_active" } };
    expect(hotelFormDraftView.safeParse(gone).success).toBe(false);
    expect(hotelFormDraftView.safeParse({ ...draft, people: [] }).success).toBe(false);
    const mobile = { ...draft.contributors[0], phone: "+917000001234" };
    expect(hotelFormDraftView.safeParse({ ...draft, contributors: [mobile] }).success).toBe(false);
  });
});

describe("a section's save", () => {
  it("takes the section's answers, the version they were based on and No changes", () => {
    const body = { answers: { totalRooms: 40 }, expectedVersion: 0, noChanges: false };
    expect(hotelFormSectionSaveRequest("rooms").parse(body)).toEqual(body);
    expect(
      hotelFormSectionSaveRequest("rooms").safeParse({ ...body, expectedVersion: -1 }).success,
    ).toBe(false);
    expect(
      hotelFormSectionSaveRequest("rooms").safeParse({ ...body, answers: { name: "x" } }).success,
    ).toBe(false);
    expect(
      hotelFormSectionSaveRequest("property").safeParse({ answers: {}, expectedVersion: 2 })
        .success,
    ).toBe(false);
    expect(hotelFormSectionParams.parse({ sectionKey: "booking_terms" })).toEqual({
      sectionKey: "booking_terms",
    });
    expect(hotelFormSectionParams.safeParse({ sectionKey: "photos" }).success).toBe(false);
  });

  it("answers the section's version, completeness, content hash and last editor after the save", () => {
    const saved = {
      version: 4,
      isComplete: true,
      contentHash: "a".repeat(64),
      lastEditedBy: "Synthetic Colleague",
      lastEditedAt: at,
    };
    expect(hotelFormSectionSaved.parse(saved)).toEqual(saved);
    expect(hotelFormSectionSaved.parse({ ...saved, lastEditedBy: null }).lastEditedBy).toBeNull();
    const { lastEditedAt: _at, ...noTime } = saved;
    expect(hotelFormSectionSaved.safeParse(noTime).success).toBe(false);
    expect(hotelFormSectionSaved.safeParse({ ...saved, version: 0 }).success).toBe(false);
    expect(hotelFormSectionSaved.safeParse({ ...saved, contentHash: "A".repeat(64) }).success).toBe(
      false,
    );
  });
});

describe("the 409s' details", () => {
  const conflict: HotelFormSectionConflict<"contact"> = {
    section: "contact",
    version: 5,
    answers: { contacts: [{ name: "Synthetic Sales", email: "sales@hotel.example" }] },
    noChanges: false,
    editedBy: "Synthetic Colleague",
    editedAt: at,
  };

  it("carry a colleague's newer save, which the page reads back for that section only", () => {
    const details = hotelFormSectionConflictDetails(conflict);
    expect(details).toHaveLength(1);
    expect(details[0]?.path).toBe(HOTEL_FORM_CONFLICT_PATH);
    const error = new AppError("conflict", "A colleague saved this section", details);
    expect(hotelFormSectionConflictOf(error, "contact")).toEqual(conflict);
    expect(hotelFormSectionConflictOf(error, "rooms")).toBeNull();
    expect(
      hotelFormSectionConflictOf({ code: "validation_failed", details }, "contact"),
    ).toBeNull();
    const broken = [{ path: HOTEL_FORM_CONFLICT_PATH, message: "{not json" }];
    expect(hotelFormSectionConflictOf({ code: "conflict", details: broken }, "contact")).toBeNull();
  });

  it("carry who submitted and when, for a request no longer open to changes", () => {
    const readOnly = {
      status: "submitted" as const,
      submittedBy: "Synthetic Person",
      submittedAt: at,
    };
    const details = hotelFormReadOnlyDetails(readOnly);
    expect(details[0]?.path).toBe(HOTEL_FORM_READ_ONLY_PATH);
    expect(hotelFormReadOnlyOf({ code: "conflict", details })).toEqual(readOnly);
    expect(hotelFormReadOnlyOf({ code: "conflict" })).toBeNull();
    expect(
      hotelFormReadOnlyOf({ code: "conflict", details: hotelFormSectionConflictDetails(conflict) }),
    ).toBeNull();
  });
});

describe("a section over its cap (400 sectionTooLarge)", () => {
  it("names the cap of the section it refused, on the answers, never as a section's missing item", () => {
    expect(hotelFormSectionTooLargeDetails("rooms")).toEqual([
      { path: HOTEL_FORM_TOO_LARGE_PATH, message: "Keep this section under 96 KB" },
    ]);
    expect(hotelFormSectionTooLargeDetails("property")[0]?.message).toBe(
      "Keep this section under 32 KB",
    );
    const refused = new AppError(
      "validation_failed",
      HOTEL_FORM_ERRORS.sectionTooLarge,
      hotelFormSectionTooLargeDetails("venues"),
    );
    expect(hotelFormMissingItemsOf(refused)).toEqual([]);
  });
});
