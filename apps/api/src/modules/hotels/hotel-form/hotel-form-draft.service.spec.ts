import {
  HOTEL_CUISINE_OTHER,
  HOTEL_FACILITY_OPTIONS,
  HOTEL_FACILITY_OTHER,
  HOTEL_FORM_CAPS,
  hotelFormDraftView,
  hotelFormSessionRefusalOf,
} from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { ConfigService } from "../../admin/config/config.service.js";
import { refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_COLLEAGUE_ID,
  FORM_EARLIER,
  FORM_LATER,
  FORM_PERSON_ID,
  FORM_REFERENCE,
  FORM_REQUEST_ID,
  formSession,
  formSubmission,
  formSubmissions,
  sectionRow,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import { HotelFormDraft } from "./hotel-form-draft.service.js";
import type { ContributorRow, HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import type { HotelFormSectionsRepository, SectionRow } from "./hotel-form-sections.repository.js";
import type { FormSubmission } from "./hotel-form-submissions.repository.js";

/*
 * `GET /hotel-form/draft` (D-190 §3) with fakes: every section, saved or not, with its version,
 * completeness, No changes and last editor; the request's reference, kind, status and state, label, note
 * and who submitted; the people helping by name and designation; the caps; the cuisine and facility
 * choices. Nothing from the catalogue. Synthetic data only.
 */

const CUISINES = ["Indian", "Continental"];

const PEOPLE: readonly ContributorRow[] = [
  {
    id: FORM_PERSON_ID,
    fullName: "Synthetic Person",
    designation: "General Manager",
    isNamed: true,
  },
  {
    id: FORM_COLLEAGUE_ID,
    fullName: "Synthetic Colleague",
    designation: "Sales Manager",
    isNamed: true,
  },
];

function build(
  options: {
    readonly request?: FormSubmission | null;
    readonly rows?: SectionRow[];
    readonly people?: readonly ContributorRow[];
  } = {},
) {
  const submissions = formSubmissions(
    options.request === undefined ? formSubmission() : options.request,
  );
  const list = vi.fn(async () => options.rows ?? []);
  const contributors = vi.fn(async () => options.people ?? PEOPLE);
  const get = vi.fn(async () => ({ options: CUISINES }));
  const warn = vi.fn();
  const draft = new HotelFormDraft(
    submissions.typed,
    { list } as unknown as HotelFormSectionsRepository,
    { contributors } as unknown as HotelFormPeopleRepository,
    { get } as unknown as ConfigService,
    { warn } as unknown as AppLogger,
  );
  return { draft, submissions: submissions.repository, list, get, warn };
}

describe("HotelFormDraft.get", () => {
  it("answers every section, a saved one with its editor and an unsaved one at version 0", async () => {
    const rooms = sectionRow("rooms", { totalRooms: 40 }, { version: 3, isComplete: false });
    const built = build({ rows: [rooms] });
    const view = await built.draft.get(formSession());
    expect(hotelFormDraftView.parse(view)).toEqual(view);
    expect(view.sections.rooms).toEqual({
      answers: { totalRooms: 40 },
      version: 3,
      isComplete: false,
      noChanges: false,
      lastEditedBy: "Synthetic Colleague",
      lastEditedAt: FORM_EARLIER.toISOString(),
      isLastSaveYours: false,
      isUnreadable: false,
    });
    expect(view.sections.property).toEqual({
      answers: {},
      version: 0,
      isComplete: false,
      noChanges: false,
      lastEditedBy: null,
      lastEditedAt: null,
      isLastSaveYours: false,
      isUnreadable: false,
    });
    // The fact sheet section asks only its date until its uploads arrive (Slice 9): never incomplete.
    expect(view.sections.fact_sheet_media.isComplete).toBe(true);
  });

  it("counts each section's completeness from its stored answers and the current schema, not the stored flag", async () => {
    const cuisines = sectionRow("food_beverage", { cuisines: ["Indian"] }, { isComplete: false });
    const rooms = sectionRow("rooms", { totalRooms: 40 }, { isComplete: true });
    const view = await build({ rows: [cuisines, rooms] }).draft.get(formSession());
    expect(view.sections.food_beverage.isComplete).toBe(true);
    expect(view.sections.rooms.isComplete).toBe(false);
  });

  it("says a section is the caller's when they saved it last, by person and never by name", async () => {
    const mine = sectionRow("rooms", { totalRooms: 40 }, { lastEditorPersonId: FORM_PERSON_ID });
    // A colleague who shares the caller's name saved the property: theirs, whatever the name.
    const namesake = sectionRow(
      "property",
      { name: "Synthetic Lake Palace" },
      {
        lastEditedBy: "Synthetic Person",
      },
    );
    const view = await build({ rows: [mine, namesake] }).draft.get(formSession());
    expect(view.sections.rooms.isLastSaveYours).toBe(true);
    expect(view.sections.property.isLastSaveYours).toBe(false);
    expect(view.sections.venues.isLastSaveYours).toBe(false);
  });

  it("answers the request's reference, kind, status and state, label, note and expiry", async () => {
    const view = await build().draft.get(formSession());
    expect(view.request).toEqual({
      reference: FORM_REFERENCE,
      kind: "onboarding",
      status: "open",
      state: "ready",
      displayLabel: "Monsoon refresh",
      staffNote: "Rooms first, please",
      expiresAt: FORM_LATER.toISOString(),
      submittedAt: null,
      submittedBy: null,
    });
  });

  it("answers who submitted and when, and the state the status says, once submitted", async () => {
    const view = await build({ request: submittedRequest() }).draft.get(formSession());
    expect(view.request).toMatchObject({
      status: "submitted",
      state: "locked",
      submittedAt: FORM_EARLIER.toISOString(),
      submittedBy: "Synthetic Person",
    });
  });

  it("names the people helping by name and designation, marking the caller, never their mobiles", async () => {
    const view = await build().draft.get(formSession());
    expect(view.contributors).toEqual([
      { fullName: "Synthetic Person", designation: "General Manager", isYou: true },
      { fullName: "Synthetic Colleague", designation: "Sales Manager", isYou: false },
    ]);
  });

  it("leaves unnamed another person who withdrew their privacy notice consent, though never the caller", async () => {
    const withdrawn = PEOPLE.map((person) => ({ ...person, isNamed: false }));
    const view = await build({ people: withdrawn }).draft.get(formSession());
    expect(view.contributors).toEqual([
      { fullName: "Synthetic Person", designation: "General Manager", isYou: true },
      { fullName: null, designation: null, isYou: false },
    ]);
    const unnamed = sectionRow("rooms", { totalRooms: 40 }, { lastEditedBy: null });
    const rooms = await build({
      rows: [unnamed],
      request: submittedRequest({ submittedBy: null }),
    }).draft.get(formSession());
    expect(rooms.sections.rooms).toMatchObject({
      lastEditedBy: null,
      lastEditedAt: FORM_EARLIER.toISOString(),
    });
    expect(rooms.request).toMatchObject({
      submittedBy: null,
      submittedAt: FORM_EARLIER.toISOString(),
    });
  });

  it("answers the caps and the cuisine and facility choices, each with its Other", async () => {
    const built = build();
    const view = await built.draft.get(formSession());
    expect(view.caps).toEqual(HOTEL_FORM_CAPS);
    expect(view.options).toEqual({
      cuisines: { options: CUISINES, other: HOTEL_CUISINE_OTHER },
      facilities: { options: [...HOTEL_FACILITY_OPTIONS], other: HOTEL_FACILITY_OTHER },
    });
    expect(built.get).toHaveBeenCalledWith("hotel.cuisine_options");
    expect(built.submissions.noticeSubject).not.toHaveBeenCalled();
  });

  it("answers 401 not_active for a request that left the form since the guard passed", async () => {
    for (const request of [null, formSubmission({ status: "rejected" })]) {
      const refused = await refusalOf(build({ request }).draft.get(formSession()));
      expect(refused && hotelFormSessionRefusalOf(refused)).toBe("not_active");
    }
  });

  it("answers a stored section that no longer reads as unreadable and empty, never failing the draft", async () => {
    const broken = sectionRow("rooms", { rows: "many", totalRooms: 40 }, { version: 4 });
    const property = sectionRow("property", { name: "Synthetic Lake Palace" });
    const built = build({ rows: [broken, property] });
    const view = await built.draft.get(formSession());
    expect(hotelFormDraftView.parse(view)).toEqual(view);
    expect(view.sections.rooms).toEqual({
      answers: {},
      version: 4,
      isComplete: false,
      noChanges: false,
      lastEditedBy: "Synthetic Colleague",
      lastEditedAt: FORM_EARLIER.toISOString(),
      isLastSaveYours: false,
      isUnreadable: true,
    });
    expect(view.sections.property).toMatchObject({
      answers: { name: "Synthetic Lake Palace" },
      isUnreadable: false,
    });
    expect(view.sections.venues.isUnreadable).toBe(false);
  });

  it("logs a section that no longer reads by its request, key and versions, never its answers", async () => {
    const broken = sectionRow("rooms", { rows: "Synthetic many", totalRooms: 40 }, { version: 4 });
    const built = build({ rows: [broken] });
    await built.draft.get(formSession());
    expect(built.warn).toHaveBeenCalledTimes(1);
    expect(built.warn).toHaveBeenCalledWith("hotel_form.section_unreadable", {
      requestId: FORM_REQUEST_ID,
      section: "rooms",
      version: 4,
      schemaVersion: 1,
      issues: [{ path: "rows", code: "invalid_type" }],
    });
    expect(JSON.stringify(built.warn.mock.calls)).not.toContain("Synthetic many");
  });
});
