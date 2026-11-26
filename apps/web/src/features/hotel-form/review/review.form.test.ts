import {
  AppError,
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_DISPLAY_VERSION,
  HOTEL_FORM_ERRORS,
  hotelFormMissingItemDetails,
  hotelFormReadOnlyDetails,
  hotelFormSectionsChangedDetails,
  hotelFormSessionError,
  type HotelFormDraftView,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { DRAFT, EDITED_AT } from "../draft.test-fixtures";
import {
  COLLEAGUE_WINDOW_MS,
  EMPTY_DECLARATIONS,
  colleagueSavesOf,
  incompleteSectionsOf,
  missingItemsOf,
  missingItemWhere,
  submitCheckOf,
  submitRefusalOf,
} from "./review.form";

/* HF-06's rules (D-190 §5): what Submit needs, who saved lately, and each refusal the API answers. */

const ROW = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const EDITED = Date.parse(EDITED_AT);

/** The draft with every section's answers as given, the rest as the fixture has them. */
function draftWith(sections: Partial<Record<keyof HotelFormDraftView["sections"], object>>) {
  const next = { ...DRAFT.sections };
  for (const [key, answers] of Object.entries(sections))
    Object.assign(next, { [key]: { ...DRAFT.sections[key as keyof typeof next], answers } });
  return { ...DRAFT, sections: next };
}

const READY = draftWith({
  property: { name: "Synthetic Lake Palace", city: "Udaipur", state: "Rajasthan" },
  contact: { contacts: [{ name: "Synthetic Contact", email: "events@hotel.example" }] },
});

describe("what Submit needs", () => {
  it("asks for 7.4's tick and an explicit 7.5 in core's words, before anything else", () => {
    const check = submitCheckOf(EMPTY_DECLARATIONS, READY, "token");
    expect(check.errors).toEqual({
      accuracy: "Confirm that the information is correct",
      display: "Answer Yes or No",
    });
    expect(check.step).toEqual({ kind: "fix_declarations" });
  });

  it("then the missing items, then a passed bot check, then sends what the page showed", () => {
    const fields = { accuracyAccepted: true, displayAnswer: "no" } as const;
    const missing = submitCheckOf(fields, DRAFT, "token");
    expect(missing.errors).toEqual({});
    expect(missing.step.kind).toBe("incomplete");
    expect(submitCheckOf(fields, READY, null).step).toEqual({ kind: "bot_check" });
    expect(submitCheckOf(fields, READY, "token").step).toEqual({
      kind: "send",
      request: {
        accuracy: { accepted: true, textVersion: HOTEL_FORM_ACCURACY_VERSION },
        display: { answer: "no", textVersion: HOTEL_FORM_DISPLAY_VERSION },
        // Every section's version as the page showed it, 0 for one never saved.
        sectionVersions: {
          property: 3,
          contact: 2,
          rooms: 2,
          venues: 0,
          booking_terms: 0,
          food_beverage: 0,
          fact_sheet_media: 0,
        },
        botToken: "token",
      },
    });
  });
});

describe("the missing items", () => {
  it("are core's, for the request's kind: a new hotel's name, city, state and a contact", () => {
    expect(missingItemsOf(DRAFT).map((item) => `${item.section}.${item.field}`)).toEqual([
      "property.state",
      "contact.contacts",
    ]);
    expect(missingItemsOf(READY)).toEqual([]);
    expect(missingItemsOf({ ...DRAFT, request: { ...DRAFT.request, kind: "refresh" } })).toEqual(
      [],
    );
  });

  it("name a section whose stored answers no longer read, as the API's submit check would", () => {
    const rooms = { ...READY.sections.rooms, answers: {}, isUnreadable: true };
    const draft = { ...READY, sections: { ...READY.sections, rooms } };
    expect(missingItemsOf(draft)).toEqual([
      { section: "rooms", field: null, message: "Check this section and save it again" },
    ]);
  });

  it("say where each is: the section, and the row by its name or its place", () => {
    const draft = draftWith({
      venues: {
        rows: [
          {
            rowId: ROW,
            name: "Synthetic Lawn",
            seated: { min: 250 },
            otherLayouts: [{ layout: "Classroom" }],
          },
        ],
      },
      contact: { contacts: [{ role: "Events" }] },
    });
    const where = (section: "venues" | "contact" | "property", field: string | null) =>
      missingItemWhere({ section, field, message: "" }, draft.sections);
    expect(where("venues", "rows.0.seated.max")).toBe("Venues · Synthetic Lawn");
    expect(where("venues", "rows.0.otherLayouts.0.max")).toBe(
      "Venues · Synthetic Lawn · Classroom",
    );
    expect(where("contact", "contacts.0.name")).toBe("Contact for weddings and events · Contact 1");
    expect(where("property", "name")).toBe("Property and location");
    expect(where("venues", null)).toBe("Venues");
  });

  it("warn about sections not complete, which never block", () => {
    expect(incompleteSectionsOf(DRAFT)).toEqual([
      "property",
      "rooms",
      "venues",
      "booking_terms",
      "food_beverage",
    ]);
  });
});

describe("a colleague's recent save", () => {
  const now = EDITED + 60_000;

  it("is any save in the last five minutes by anyone but you, a colleague unnamed included", () => {
    const sections = {
      ...DRAFT.sections,
      venues: { ...DRAFT.sections.venues, lastEditedBy: null, lastEditedAt: EDITED_AT },
    };
    expect(colleagueSavesOf({ ...DRAFT, sections }, now)).toEqual([
      { section: "property", editedBy: "Ravi Kumar", editedAt: EDITED_AT },
      { section: "rooms", editedBy: "Ravi Kumar", editedAt: EDITED_AT },
      { section: "venues", editedBy: null, editedAt: EDITED_AT },
    ]);
    expect(colleagueSavesOf(DRAFT, EDITED + COLLEAGUE_WINDOW_MS)).toEqual([]);
  });

  it("tells your own saves by person, never by name: a namesake's is a colleague's, yours renamed is yours", () => {
    const sections = {
      ...DRAFT.sections,
      // A colleague who shares your name saved the venues.
      venues: {
        ...DRAFT.sections.venues,
        lastEditedBy: "Asha Rao",
        lastEditedAt: EDITED_AT,
        isLastSaveYours: false,
      },
      // You saved the contact under the name you had before "Edit your details".
      contact: { ...DRAFT.sections.contact, lastEditedBy: "Asha R.", isLastSaveYours: true },
    };
    const saves = colleagueSavesOf({ ...DRAFT, sections }, now).map((save) => save.section);
    expect(saves).toContain("venues");
    expect(saves).not.toContain("contact");
  });
});

describe("a refused submit", () => {
  it("names the sections a colleague changed, in the form's order", () => {
    const error = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionsChanged,
      hotelFormSectionsChangedDetails(["venues", "contact"]),
    );
    expect(submitRefusalOf(error)).toEqual({
      kind: "sections_changed",
      message: HOTEL_FORM_ERRORS.sectionsChanged,
      sections: ["contact", "venues"],
    });
  });

  it("lists every missing item the API found, deep paths included", () => {
    const items = [
      {
        section: "venues" as const,
        field: "rows.0.seated.max",
        message: "Give the most guests seated",
      },
    ];
    const error = new AppError(
      "validation_failed",
      HOTEL_FORM_ERRORS.submitIncomplete,
      hotelFormMissingItemDetails(items),
    );
    expect(submitRefusalOf(error)).toEqual({
      kind: "incomplete",
      message: HOTEL_FORM_ERRORS.submitIncomplete,
      items,
    });
  });

  it("tells a failed bot check, old wording, an earlier submit and a wait apart", () => {
    const bot = new AppError("validation_failed", HOTEL_FORM_ERRORS.botCheck, [
      { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck },
    ]);
    expect(submitRefusalOf(bot)).toEqual({ kind: "bot", message: HOTEL_FORM_ERRORS.botCheck });
    const stale = new AppError("conflict", HOTEL_FORM_ERRORS.noticeStale);
    expect(submitRefusalOf(stale)).toEqual({
      kind: "reload",
      message: HOTEL_FORM_ERRORS.noticeStale,
    });
    const already = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.alreadySubmitted,
      hotelFormReadOnlyDetails({ status: "submitted", submittedBy: null, submittedAt: EDITED_AT }),
    );
    expect(submitRefusalOf(already)).toEqual({
      kind: "already_submitted",
      message: HOTEL_FORM_ERRORS.alreadySubmitted,
    });
    const wait = new AppError("rate_limited", "Too many requests", undefined, 429, 42);
    expect(submitRefusalOf(wait)).toEqual({
      kind: "wait",
      message: "Too many tries in a short time. Please wait, then try again.",
      seconds: 42,
    });
    expect(submitRefusalOf(hotelFormSessionError("session_expired")).kind).toBe("session");
    expect(submitRefusalOf(new Error("boom"))).toEqual({
      kind: "message",
      message: "Something went wrong on our side. Please try again in a few minutes.",
    });
  });
});
