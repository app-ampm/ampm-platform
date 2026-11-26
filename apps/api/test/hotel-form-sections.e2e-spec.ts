import { createHash } from "node:crypto";

import {
  AppError,
  canonicalJson,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SECTION_MAX_BYTES,
  hotelFormDraftView,
  hotelFormSectionConflictOf,
} from "@ampm/core";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { draftCalls, firstSave, PROPERTY, roomsOfSize } from "./hotel-form-draft-suite.js";
import {
  freshMobile,
  setPolicy,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
} from "./hotel-form-suite.js";

/*
 * The hotel form's draft and a section's autosave end to end (D-190 §3), against the test database and the
 * real 100 KB JSON parser: the draft answers every section, the request and the people helping; a section
 * saves from version 0, then only from its current version; a null and a missing answer are one content,
 * stored canonically; a stale version is 409 sectionConflict carrying the colleague's save; two people's
 * concurrent first saves end in one 409, never a 500; a maximal rooms section (just under 96 KB of
 * canonical JSON) saves, one over its cap is 400 sectionTooLarge; and the mode off answers 404 before the
 * body is read. Synthetic data only.
 */
describe("The hotel form's draft and sections (e2e, D-190 §3)", () => {
  let suite: FormSuite;
  const calls = draftCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-sections-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  /** An error as the api-client rebuilds it from a refusal's envelope. */
  const refusalOf = (response: Response) =>
    new AppError(
      response.body.error.code,
      response.body.error.message,
      response.body.error.details,
    );
  const sha256 = (value: unknown) =>
    createHash("sha256").update(canonicalJson(value)).digest("hex");

  it("answers the draft: every section unsaved, the request, the people helping, caps and choices", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const draft = await calls.draft(sessionToken).expect(200);
    const view = hotelFormDraftView.parse(draft.body.data);
    expect(view.request).toMatchObject({
      kind: "onboarding",
      status: "open",
      state: "ready",
      submittedAt: null,
      submittedBy: null,
    });
    expect(view.request.reference).toMatch(/^HIR-\d{4}-\d{4,}$/);
    expect(view.sections.rooms).toEqual({
      answers: {},
      version: 0,
      isComplete: false,
      noChanges: false,
      lastEditedBy: null,
      lastEditedAt: null,
    });
    expect(view.contributors).toEqual([
      { fullName: "E2E Synthetic Person", designation: "General Manager", isYou: true },
    ]);
    expect(view.caps.sectionMaxBytes.rooms).toBe(HOTEL_FORM_SECTION_MAX_BYTES.rooms);
    expect(view.options.cuisines.options.length).toBeGreaterThan(0);
    expect(JSON.stringify(draft.body)).not.toMatch(/\+91|7000/);
  });

  it("saves from version 0, then the next version; a null and a missing answer are one content", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const first = await calls
      .save(sessionToken, "property", firstSave({ name: " E2E Lake Palace ", city: null }))
      .expect(200);
    expect(first.body.data).toEqual({
      version: 1,
      isComplete: false,
      contentHash: sha256({ name: "E2E Lake Palace" }),
    });
    const row = await suite.prisma.hotelInfoRequestSection.findFirstOrThrow({
      where: { requestId: link.id, sectionKey: "property" },
    });
    expect(row.answers).toEqual({ name: "E2E Lake Palace" });
    expect(row).toMatchObject({
      version: 1,
      schemaVersion: 1,
      contentHash: first.body.data.contentHash,
    });
    // The same content without the null key: nothing written, the version as it stands.
    const unchanged = await calls
      .save(sessionToken, "property", {
        ...firstSave({ name: "E2E Lake Palace" }),
        expectedVersion: 1,
      })
      .expect(200);
    expect(unchanged.body.data.version).toBe(1);
    const after = await suite.prisma.hotelInfoRequestSection.findFirstOrThrow({
      where: { id: row.id },
    });
    expect(after.updatedAt).toEqual(row.updatedAt);
    const next = await calls
      .save(sessionToken, "property", {
        answers: { name: "E2E Lake Palace", city: "Udaipur" },
        expectedVersion: 1,
        noChanges: false,
      })
      .expect(200);
    expect(next.body.data.version).toBe(2);
    const draft = hotelFormDraftView.parse((await calls.draft(sessionToken).expect(200)).body.data);
    expect(draft.sections.property).toMatchObject({
      answers: { name: "E2E Lake Palace", city: "Udaipur" },
      version: 2,
      lastEditedBy: "E2E Synthetic Person",
    });
    // A save writes no event: a request's last activity comes from its sections.
    const events = await suite.prisma.hotelInfoRequestEvent.count({
      where: {
        requestId: link.id,
        eventType: { notIn: ["created", "code_requested", "person_verified"] },
      },
    });
    expect(events).toBe(0);
  });

  it("refuses a stale version with 409 sectionConflict, carrying the colleague's save", async () => {
    const link = await testLink(suite);
    const me = await signIn(suite, link.secret, freshMobile());
    const colleague = await signIn(suite, link.secret, freshMobile(), {
      fullName: "E2E Colleague",
    });
    await calls
      .save(colleague.sessionToken, "contact", firstSave({ contacts: [{ name: "E2E Theirs" }] }))
      .expect(200);
    const refused = await calls
      .save(me.sessionToken, "contact", firstSave({ contacts: [{ name: "E2E Mine" }] }))
      .expect(409);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.sectionConflict);
    expect(hotelFormSectionConflictOf(refusalOf(refused), "contact")).toMatchObject({
      version: 1,
      answers: { contacts: [{ name: "E2E Theirs" }] },
      editedBy: "E2E Colleague",
    });
    // Keep mine: saved on their version.
    await calls
      .save(me.sessionToken, "contact", {
        answers: { contacts: [{ name: "E2E Mine" }] },
        expectedVersion: 1,
        noChanges: false,
      })
      .expect(200);
  });

  it("ends two people's concurrent first saves of one section in one 409, never a 500", async () => {
    const link = await testLink(suite);
    const a = await signIn(suite, link.secret, freshMobile());
    const b = await signIn(suite, link.secret, freshMobile(), { fullName: "E2E Second Person" });
    const [first, second] = await Promise.all([
      calls.save(a.sessionToken, "booking_terms", firstSave({ minNights: 2 })),
      calls.save(b.sessionToken, "booking_terms", firstSave({ minNights: 3 })),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const rows = await suite.prisma.hotelInfoRequestSection.count({
      where: { requestId: link.id, sectionKey: "booking_terms" },
    });
    expect(rows).toBe(1);
  });

  it("saves a maximal rooms section, just under 96 KB of canonical JSON, through the 100 KB parser", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const cap = HOTEL_FORM_SECTION_MAX_BYTES.rooms;
    const answers = roomsOfSize(cap - 1);
    const body = JSON.stringify(firstSave(answers));
    expect(body.length).toBeLessThan(100 * 1024);
    const saved = await calls.save(sessionToken, "rooms", firstSave(answers)).expect(200);
    expect(saved.body.data.version).toBe(1);
    // One byte over the cap, the body still under the parser's limit: 400 sectionTooLarge, naming it.
    const tooLarge = await calls
      .save(sessionToken, "rooms", {
        answers: roomsOfSize(cap + 1),
        expectedVersion: 1,
        noChanges: false,
      })
      .expect(400);
    expect(tooLarge.body.error.message).toBe(HOTEL_FORM_ERRORS.sectionTooLarge);
    expect(tooLarge.body.error.details).toEqual([
      { path: "answers", message: "Keep this section under 96 KB" },
    ]);
    // Past the parser's 100 KB, the body is refused before any guard reads it.
    const huge = { ...firstSave({}), padding: "p".repeat(101 * 1024) };
    await calls.save(sessionToken, "rooms", huge).expect(413);
  });

  it("refuses No changes on an onboarding request, an unknown section and an unknown answer", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const noChanges = await calls
      .save(sessionToken, "rooms", { answers: {}, expectedVersion: 0, noChanges: true })
      .expect(400);
    expect(noChanges.body.error.details).toEqual([
      { path: "noChanges", message: HOTEL_FORM_ERRORS.noChangesOnOnboarding },
    ]);
    await calls.save(sessionToken, "photos", firstSave({})).expect(400);
    const unknown = await calls.save(sessionToken, "property", firstSave({ stars: 5 })).expect(400);
    expect(unknown.body.error.details[0].path).toBe("answers");
    await calls.save(sessionToken, "property", firstSave(PROPERTY)).expect(200);
  });

  it("holds a session to 30 saves a minute, unchanged ones counted too", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await calls
      .save(sessionToken, "food_beverage", firstSave({ cuisines: ["Indian"] }))
      .expect(200);
    const again = { answers: { cuisines: ["Indian"] }, expectedVersion: 1, noChanges: false };
    for (let save = 1; save < 30; save += 1) {
      await calls.save(sessionToken, "food_beverage", again).expect(200);
    }
    const over = await calls.save(sessionToken, "food_beverage", again).expect(429);
    expect(over.body.error.message).toBe(HOTEL_FORM_ERRORS.writeLimit);
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("answers 404 on the draft and a save while the mode is off, before the body is read", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    await setPolicy(suite, { mode: "off" });
    try {
      await calls.draft(sessionToken).expect(404);
      await calls.save(sessionToken, "rooms", { not: "a section" }).expect(404);
    } finally {
      await setPolicy(suite, { mode: "test_only" });
    }
  });
});
