import { HOTEL_FORM_ERRORS, hotelFormSectionConflictOf } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_EARLIER,
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  formSession,
  formSubmission,
  hashOf,
  sectionRow,
} from "../testing/hotel-form-draft-fixtures.js";
import { build, save } from "../testing/hotel-form-section-saves-fakes.js";
import type { SectionWrite } from "./hotel-form-sections.repository.js";

/*
 * A section's autosave (D-190 §3) with fakes: under the request's lock, the first save makes the row at
 * version 1 from `expectedVersion` 0; a later one writes the next version only from the current one; an
 * unchanged content (the same hash and No changes) writes nothing; a stale version is 409
 * sectionConflict with the colleague's save; a request no longer open is 409 readOnly with who submitted;
 * over the cap is 400 sectionTooLarge; No changes is for a refresh only; and every save counts against the
 * session's and the request's windows (what is refused is in hotel-form-section-saves.refusals.spec.ts).
 * The database side is in test/hotel-form-sections.e2e-spec.ts.
 */

describe("HotelFormSectionSaves: the first save of a section", () => {
  it("makes the row at version 1 from expectedVersion 0, storing its canonical answers and hash", async () => {
    const built = build();
    const answers = { name: "Synthetic Lake Palace", city: null, facilities: [] };
    const saved = await save(built, "property", { answers, expectedVersion: 0, noChanges: false });
    expect(saved).toEqual({
      version: 1,
      isComplete: false,
      contentHash: hashOf({ name: "Synthetic Lake Palace" }),
      lastEditedBy: "Synthetic Person",
      lastEditedAt: FORM_NOW.toISOString(),
    });
    expect(built.allowSectionSave).toHaveBeenCalledWith(formSession().challengeId, FORM_REQUEST_ID);
    expect(built.lock).toHaveBeenCalledWith(FORM_REQUEST_ID, FORM_TX);
    const [requestId, key, write] = built.createFirst.mock.calls[0] ?? [];
    expect([requestId, key]).toEqual([FORM_REQUEST_ID, "property"]);
    expect(write).toEqual<SectionWrite>({
      schemaVersion: 1,
      answers: { name: "Synthetic Lake Palace" },
      contentHash: hashOf({ name: "Synthetic Lake Palace" }),
      isComplete: false,
      noChanges: false,
      editorPersonId: FORM_PERSON_ID,
      at: FORM_NOW,
    });
  });

  it("stores whether the section is complete, as core counts it", async () => {
    const built = build();
    const answers = { cuisines: ["Indian"] };
    const saved = await save(built, "food_beverage", {
      answers,
      expectedVersion: 0,
      noChanges: false,
    });
    expect(saved.isComplete).toBe(true);
  });

  it("refuses a version for a section never saved, on expectedVersion", async () => {
    const built = build();
    const refused = await refusalOf(
      save(built, "rooms", { answers: {}, expectedVersion: 2, noChanges: false }),
    );
    expect(refused?.status).toBe(400);
    expect(refused?.details?.[0]?.path).toBe("expectedVersion");
    expect(built.createFirst).not.toHaveBeenCalled();
  });

  it("answers a first save that lost the race to a colleague's as a conflict carrying theirs", async () => {
    const theirs = sectionRow("contact", { contacts: [{ name: "Synthetic Colleague" }] });
    const built = build({ created: false });
    built.find.mockResolvedValueOnce(null).mockResolvedValueOnce(theirs);
    const mine = { contacts: [{ name: "Synthetic Person" }] };
    const refused = await refusalOf(
      save(built, "contact", { answers: mine, expectedVersion: 0, noChanges: false }),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.sectionConflict);
    expect(refused && hotelFormSectionConflictOf(refused, "contact")).toEqual({
      section: "contact",
      version: 1,
      answers: { contacts: [{ name: "Synthetic Colleague" }] },
      noChanges: false,
      editedBy: "Synthetic Colleague",
      editedAt: FORM_EARLIER.toISOString(),
    });
  });
});

describe("HotelFormSectionSaves: a later save", () => {
  const stored = { name: "Synthetic Lake Palace" };

  it("writes the next version only from the current one", async () => {
    const built = build({ current: sectionRow("property", stored, { version: 3 }) });
    const answers = { name: "Synthetic Lake Palace", city: "Udaipur" };
    const saved = await save(built, "property", { answers, expectedVersion: 3, noChanges: false });
    expect(saved).toEqual({
      version: 4,
      isComplete: false,
      contentHash: hashOf(answers),
      lastEditedBy: "Synthetic Person",
      lastEditedAt: FORM_NOW.toISOString(),
    });
    expect(built.updateIf).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      "property",
      3,
      expect.objectContaining({ answers, contentHash: hashOf(answers) }),
      FORM_TX,
    );
  });

  it("writes nothing for an unchanged content, null and missing keys alike, whatever version it names", async () => {
    const built = build({ current: sectionRow("property", stored, { version: 5 }) });
    // As the controller hands them over: read through the draft, so blank text is already null.
    const answers = { name: "Synthetic Lake Palace", city: null, groupName: null, facilities: [] };
    const saved = await save(built, "property", { answers, expectedVersion: 2, noChanges: false });
    expect(saved).toEqual({
      version: 5,
      isComplete: false,
      contentHash: hashOf(stored),
      lastEditedBy: "Synthetic Colleague",
      lastEditedAt: FORM_EARLIER.toISOString(),
    });
    expect(built.updateIf).not.toHaveBeenCalled();
    expect(built.createFirst).not.toHaveBeenCalled();
  });

  it("answers an unchanged save with who saved it last and when, unnamed once they withdrew consent", async () => {
    const unnamed = sectionRow("property", stored, { version: 5, lastEditedBy: null });
    const saved = await save(build({ current: unnamed }), "property", {
      answers: stored,
      expectedVersion: 5,
      noChanges: false,
    });
    expect(saved).toMatchObject({ lastEditedBy: null, lastEditedAt: FORM_EARLIER.toISOString() });
  });

  it("counts an unchanged section's completeness from its stored answers, never the stored flag", async () => {
    const cuisines = { cuisines: ["Indian"] };
    const stale = sectionRow("food_beverage", cuisines, { version: 2, isComplete: false });
    const saved = await save(build({ current: stale }), "food_beverage", {
      answers: cuisines,
      expectedVersion: 2,
      noChanges: false,
    });
    expect(saved).toMatchObject({ version: 2, isComplete: true });
  });

  it("writes an unchanged content saved under another schema version, so the row records the current", async () => {
    const built = build({
      current: sectionRow("property", stored, { version: 5, schemaVersion: 2 }),
    });
    const saved = await save(built, "property", {
      answers: stored,
      expectedVersion: 5,
      noChanges: false,
    });
    expect(saved.version).toBe(6);
    expect(built.updateIf).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      "property",
      5,
      expect.objectContaining({ schemaVersion: 1, contentHash: hashOf(stored) }),
      FORM_TX,
    );
  });

  it("writes a change of No changes alone, on a refresh", async () => {
    const built = build({
      current: sectionRow("rooms", {}, { version: 2 }),
      locked: formSubmission({ kind: "refresh" }),
    });
    const saved = await save(built, "rooms", { answers: {}, expectedVersion: 2, noChanges: true });
    expect(saved).toMatchObject({ version: 3, isComplete: true });
    expect(built.updateIf).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      "rooms",
      2,
      expect.objectContaining({ noChanges: true, isComplete: true }),
      FORM_TX,
    );
  });

  it("refuses a stale version with 409 sectionConflict, carrying the colleague's save", async () => {
    const theirs = sectionRow("property", { name: "Their Lake Palace" }, { version: 4 });
    const built = build({ current: theirs });
    const refused = await refusalOf(
      save(built, "property", { answers: stored, expectedVersion: 3, noChanges: false }),
    );
    expect(refused?.status).toBe(409);
    expect(refused && hotelFormSectionConflictOf(refused, "property")).toMatchObject({
      version: 4,
      answers: { name: "Their Lake Palace" },
      editedBy: "Synthetic Colleague",
    });
    expect(built.updateIf).not.toHaveBeenCalled();
  });

  it("answers a write that found the version moved as a conflict, never as saved", async () => {
    const built = build({ current: sectionRow("property", stored, { version: 3 }), written: 0 });
    const answers = { name: "Another Lake Palace" };
    const refused = await refusalOf(
      save(built, "property", { answers, expectedVersion: 3, noChanges: false }),
    );
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.sectionConflict);
  });
});
