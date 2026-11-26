import { createHash, randomUUID } from "node:crypto";

import {
  AppError,
  canonicalJson,
  HOTEL_FORM_ERRORS,
  hotelFormDraftView,
  hotelFormMissingItemsOf,
} from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTACT, draftCalls, firstSave, PROPERTY } from "./hotel-form-draft-suite.js";
import {
  formCalls,
  freshMobile,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
} from "./hotel-form-suite.js";

/*
 * What the draft and a save answer about each section, end to end against the test database (D-190 §3,
 * as fixed after the reviews): completeness counted from the canonical answers stored, so a save's answer,
 * the stored flag and the next read agree; and a stored section that no longer reads under the current
 * schema (saved before a change to its questions), answered as unreadable and empty instead of failing
 * the whole draft, named by the submit check, and replaced by its next save; and whether the last save
 * of each section was the caller's, by person and never by name; and the API's clock when it read the
 * draft. Synthetic data only.
 */
describe("The hotel form's draft as each section reads back (e2e)", () => {
  let suite: FormSuite;
  const calls = draftCalls(() => suite);
  const form = formCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-draft-reads-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  const LAWN = {
    rowId: randomUUID(),
    name: "E2E Synthetic Lawn",
    setting: "outdoor",
    area: { value: 900, unit: "sqm" },
    seated: 300,
    floating: 600,
  };

  it("counts a venue row whose only answer is an all-null range as blank, in the save, the row and the read", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const blank = { rowId: randomUUID(), seated: { min: null, max: null } };
    const saved = await calls
      .save(sessionToken, "venues", firstSave({ rows: [LAWN, blank] }))
      .expect(200);
    expect(saved.body.data.isComplete).toBe(true);
    const row = await suite.prisma.hotelInfoRequestSection.findFirstOrThrow({
      where: { requestId: link.id, sectionKey: "venues" },
      select: { isComplete: true, answers: true },
    });
    expect(row.isComplete).toBe(true);
    expect(row.answers).toEqual({ rows: [LAWN, { rowId: blank.rowId }] });
    const draft = hotelFormDraftView.parse((await calls.draft(sessionToken).expect(200)).body.data);
    expect(draft.sections.venues.isComplete).toBe(true);
  });

  it("answers a stored section that no longer reads as unreadable and empty, which the submit names and a save replaces", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await calls.save(sessionToken, "property", firstSave(PROPERTY)).expect(200);
    await calls.save(sessionToken, "contact", firstSave(CONTACT)).expect(200);
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id },
      select: { id: true },
    });
    const old = { totalRooms: "forty" };
    await suite.prisma.hotelInfoRequestSection.create({
      data: {
        requestId: link.id,
        sectionKey: "rooms",
        schemaVersion: 1,
        answers: old,
        contentHash: createHash("sha256").update(canonicalJson(old)).digest("hex"),
        version: 2,
        isComplete: false,
        noChanges: false,
        lastEditorPersonId: person.id,
        lastEditedAt: new Date(),
      },
    });
    const read = hotelFormDraftView.parse((await calls.draft(sessionToken).expect(200)).body.data);
    expect(read.sections.rooms).toMatchObject({
      answers: {},
      version: 2,
      isComplete: false,
      isUnreadable: true,
    });
    expect(read.sections.property).toMatchObject({ answers: PROPERTY, isUnreadable: false });
    const refused = await calls.submit(sessionToken, await calls.reviewedBody(sessionToken));
    expect(refused.status).toBe(400);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.submitIncomplete);
    const error = new AppError("validation_failed", "", refused.body.error.details);
    expect(hotelFormMissingItemsOf(error)).toEqual([
      { section: "rooms", field: null, message: "Check this section and save it again" },
    ]);
    const saved = await calls
      .save(sessionToken, "rooms", {
        answers: { totalRooms: 40 },
        expectedVersion: 2,
        noChanges: false,
      })
      .expect(200);
    expect(saved.body.data.version).toBe(3);
    const after = hotelFormDraftView.parse((await calls.draft(sessionToken).expect(200)).body.data);
    expect(after.sections.rooms).toMatchObject({
      answers: { totalRooms: 40 },
      version: 3,
      isUnreadable: false,
    });
  });

  it("says whose the last save of each section was by person, in the draft and a save's answer, whatever the names", async () => {
    const link = await testLink(suite);
    const mine = await signIn(suite, link.secret, freshMobile());
    // A colleague who shares the person's name: a name never says whose a save was.
    const theirs = await signIn(suite, link.secret, freshMobile());
    const property = { name: "E2E Synthetic Lake Palace" };
    const saved = await calls.save(mine.sessionToken, "property", firstSave(property)).expect(200);
    expect(saved.body.data.isLastSaveYours).toBe(true);
    const sectionsOf = async (token: string) =>
      hotelFormDraftView.parse((await calls.draft(token).expect(200)).body.data).sections;
    expect((await sectionsOf(mine.sessionToken)).property.isLastSaveYours).toBe(true);
    expect((await sectionsOf(theirs.sessionToken)).property.isLastSaveYours).toBe(false);
    expect((await sectionsOf(theirs.sessionToken)).rooms.isLastSaveYours).toBe(false);
    // The colleague's save that changes nothing answers the section as it stands: still the person's.
    const unchanged = { answers: property, expectedVersion: 1, noChanges: false };
    const same = await calls.save(theirs.sessionToken, "property", unchanged).expect(200);
    expect(same.body.data).toMatchObject({ version: 1, isLastSaveYours: false });
    // After "Edit your details" the person's earlier saves are still theirs.
    await form.patchMe(mine.sessionToken, { fullName: "E2E Renamed Person" }).expect(200);
    expect((await sectionsOf(mine.sessionToken)).property.isLastSaveYours).toBe(true);
  });

  it("carries the API's clock when it read the draft", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const before = Date.now();
    const draft = hotelFormDraftView.parse((await calls.draft(sessionToken).expect(200)).body.data);
    const readAt = Date.parse(draft.readAt);
    expect(readAt).toBeGreaterThanOrEqual(before);
    expect(readAt).toBeLessThanOrEqual(Date.now());
  });
});
