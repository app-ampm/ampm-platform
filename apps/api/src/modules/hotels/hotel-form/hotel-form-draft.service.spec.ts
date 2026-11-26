import {
  HOTEL_CUISINE_OTHER,
  HOTEL_FACILITY_OPTIONS,
  HOTEL_FACILITY_OTHER,
  HOTEL_FORM_CAPS,
  hotelFormDraftView,
  hotelFormSessionRefusalOf,
} from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { ConfigService } from "../../admin/config/config.service.js";
import { refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_COLLEAGUE_ID,
  FORM_EARLIER,
  FORM_LATER,
  FORM_PERSON_ID,
  FORM_REFERENCE,
  formSession,
  formSubmission,
  formSubmissions,
  sectionRow,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import { HotelFormDraft } from "./hotel-form-draft.service.js";
import type { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import type { HotelFormSectionsRepository, SectionRow } from "./hotel-form-sections.repository.js";
import type { FormSubmission } from "./hotel-form-submissions.repository.js";

/*
 * `GET /hotel-form/draft` (D-190 §3) with fakes: every section, saved or not, with its version,
 * completeness, No changes and last editor; the request's reference, kind, status and state, label, note
 * and who submitted; the people helping by name and designation; the caps; the cuisine and facility
 * choices. Nothing from the catalogue. Synthetic data only.
 */

const CUISINES = ["Indian", "Continental"];

function build(
  options: { readonly request?: FormSubmission | null; readonly rows?: SectionRow[] } = {},
) {
  const submissions = formSubmissions(
    options.request === undefined ? formSubmission() : options.request,
  );
  const list = vi.fn(async () => options.rows ?? []);
  const contributors = vi.fn(async () => [
    { id: FORM_PERSON_ID, fullName: "Synthetic Person", designation: "General Manager" },
    { id: FORM_COLLEAGUE_ID, fullName: "Synthetic Colleague", designation: "Sales Manager" },
  ]);
  const get = vi.fn(async () => ({ options: CUISINES }));
  const draft = new HotelFormDraft(
    submissions.typed,
    { list } as unknown as HotelFormSectionsRepository,
    { contributors } as unknown as HotelFormPeopleRepository,
    { get } as unknown as ConfigService,
  );
  return { draft, submissions: submissions.repository, list, get };
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
    });
    expect(view.sections.property).toEqual({
      answers: {},
      version: 0,
      isComplete: false,
      noChanges: false,
      lastEditedBy: null,
      lastEditedAt: null,
    });
    // The fact sheet section asks only its date until its uploads arrive (Slice 9): never incomplete.
    expect(view.sections.fact_sheet_media.isComplete).toBe(true);
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

  it("never trusts a stored section that no longer reads: it is a fault, not an empty section", async () => {
    const broken = sectionRow("rooms", { rows: "many" });
    const refused = await refusalOf(build({ rows: [broken] }).draft.get(formSession()));
    expect(refused?.status).toBe(500);
  });
});
