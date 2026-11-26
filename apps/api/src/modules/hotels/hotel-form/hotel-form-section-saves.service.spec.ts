import {
  AppError,
  errors,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyOf,
  hotelFormSectionConflictOf,
  hotelFormSessionRefusalOf,
  type HotelFormSectionKey,
} from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import { refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_EARLIER,
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  formSession,
  formSubmission,
  formSubmissions,
  formTransactions,
  hashOf,
  sectionRow,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import type { HotelFormLimits } from "./hotel-form-limits.js";
import type { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { HotelFormSectionSaves } from "./hotel-form-section-saves.service.js";
import type {
  HotelFormSectionsRepository,
  SectionRow,
  SectionWrite,
} from "./hotel-form-sections.repository.js";
import type { FormSubmission } from "./hotel-form-submissions.repository.js";

/*
 * A section's autosave (D-190 §3) with fakes: under the request's lock, the first save makes the row at
 * version 1 from `expectedVersion` 0; a later one writes the next version only from the current one; an
 * unchanged content (the same hash and No changes) writes nothing; a stale version is 409
 * sectionConflict with the colleague's save; a request no longer open is 409 readOnly with who submitted;
 * over the cap is 400 sectionTooLarge; No changes is for a refresh only; and every save counts against the
 * session's and the request's windows. The database side is in test/hotel-form-sections.e2e-spec.ts.
 */

interface Built {
  readonly saves: HotelFormSectionSaves;
  readonly find: ReturnType<typeof vi.fn>;
  readonly createFirst: ReturnType<typeof vi.fn>;
  readonly updateIf: ReturnType<typeof vi.fn>;
  readonly allowSectionSave: ReturnType<typeof vi.fn>;
  readonly lock: ReturnType<typeof vi.fn>;
}

function build(
  options: {
    readonly current?: SectionRow | null;
    readonly locked?: FormSubmission | null;
    readonly created?: boolean;
    readonly written?: number;
  } = {},
): Built {
  const submissions = formSubmissions(
    options.locked === undefined ? formSubmission() : options.locked,
  );
  const find = vi.fn(async () => options.current ?? null);
  const createFirst = vi.fn(async () => options.created ?? true);
  const updateIf = vi.fn(async () => options.written ?? 1);
  const allowSectionSave = vi.fn(async () => undefined);
  const saves = new HotelFormSectionSaves(
    formTransactions() as unknown as HotelFormRequestsRepository,
    submissions.typed,
    { find, createFirst, updateIf } as unknown as HotelFormSectionsRepository,
    { allowSectionSave } as unknown as HotelFormLimits,
  );
  return {
    saves,
    find,
    createFirst,
    updateIf,
    allowSectionSave,
    lock: submissions.repository.lock,
  };
}

const save = (
  built: Built,
  key: HotelFormSectionKey,
  body: { answers: object; expectedVersion: number; noChanges: boolean },
  session = formSession(),
) => built.saves.save(session, key, body, FORM_NOW);

describe("HotelFormSectionSaves: the first save of a section", () => {
  it("makes the row at version 1 from expectedVersion 0, storing its canonical answers and hash", async () => {
    const built = build();
    const answers = { name: "Synthetic Lake Palace", city: null, facilities: [] };
    const saved = await save(built, "property", { answers, expectedVersion: 0, noChanges: false });
    expect(saved).toEqual({
      version: 1,
      isComplete: false,
      contentHash: hashOf({ name: "Synthetic Lake Palace" }),
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
    expect(saved).toEqual({ version: 4, isComplete: false, contentHash: hashOf(answers) });
    expect(built.updateIf).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      "property",
      3,
      expect.objectContaining({ answers, contentHash: hashOf(answers) }),
      FORM_TX,
    );
  });

  it("writes nothing for an unchanged content, null and missing keys alike, whatever version it names", async () => {
    const built = build({
      current: sectionRow("property", stored, { version: 5, isComplete: true }),
    });
    // As the controller hands them over: read through the draft, so blank text is already null.
    const answers = { name: "Synthetic Lake Palace", city: null, groupName: null, facilities: [] };
    const saved = await save(built, "property", { answers, expectedVersion: 2, noChanges: false });
    expect(saved).toEqual({ version: 5, isComplete: true, contentHash: hashOf(stored) });
    expect(built.updateIf).not.toHaveBeenCalled();
    expect(built.createFirst).not.toHaveBeenCalled();
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

describe("HotelFormSectionSaves: what is refused", () => {
  it("refuses a request no longer open with 409 readOnly, naming who submitted and when, uncounted", async () => {
    const built = build({ locked: submittedRequest() });
    const session = formSession({ state: "locked" });
    const refused = await refusalOf(
      save(built, "property", { answers: {}, expectedVersion: 0, noChanges: false }, session),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.readOnly);
    expect(refused && hotelFormReadOnlyOf(refused)).toEqual({
      status: "submitted",
      submittedBy: "Synthetic Person",
      submittedAt: FORM_EARLIER.toISOString(),
    });
    expect(built.allowSectionSave).not.toHaveBeenCalled();
  });

  it("refuses a save that meets a submit under the lock, though the session saw the request open", async () => {
    const built = build({ locked: submittedRequest({ status: "in_review" }) });
    const refused = await refusalOf(
      save(built, "rooms", { answers: {}, expectedVersion: 0, noChanges: false }),
    );
    expect(refused && hotelFormReadOnlyOf(refused)?.status).toBe("in_review");
    expect(built.createFirst).not.toHaveBeenCalled();
  });

  it("answers 401 not_active when the request left the form meanwhile", async () => {
    for (const locked of [null, formSubmission({ status: "revoked" })]) {
      const refused = await refusalOf(
        save(build({ locked }), "rooms", { answers: {}, expectedVersion: 0, noChanges: false }),
      );
      expect(refused && hotelFormSessionRefusalOf(refused)).toBe("not_active");
    }
  });

  it("refuses No changes on an onboarding request, on noChanges", async () => {
    const built = build();
    const refused = await refusalOf(
      save(built, "rooms", { answers: {}, expectedVersion: 0, noChanges: true }),
    );
    expect(refused?.status).toBe(400);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.noChangesOnOnboarding);
    expect(refused?.details).toEqual([
      { path: "noChanges", message: HOTEL_FORM_ERRORS.noChangesOnOnboarding },
    ]);
    expect(built.createFirst).not.toHaveBeenCalled();
  });

  it("refuses a section over its cap with 400 sectionTooLarge naming the cap, writing nothing", async () => {
    const built = build();
    // Within every field's bound, yet over the property section's 32 KB: 3-byte characters count 3.
    const answers = { accessNotes: "語".repeat(10_000), noLongerOffered: "語".repeat(2_000) };
    const refused = await refusalOf(
      save(built, "property", { answers, expectedVersion: 0, noChanges: false }),
    );
    expect(refused?.status).toBe(400);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.sectionTooLarge);
    expect(refused?.details).toEqual([
      { path: "answers", message: "Keep this section under 32 KB" },
    ]);
    expect(built.lock).not.toHaveBeenCalled();
    // The same text fits the rooms section's 96 KB.
    const rooms = { noLongerOffered: "語".repeat(2_000), rows: [] };
    expect(
      await refusalOf(
        save(build(), "rooms", { answers: rooms, expectedVersion: 0, noChanges: false }),
      ),
    ).toBeNull();
  });

  it("refuses past the session's or the request's window before reading anything", async () => {
    const built = build();
    built.allowSectionSave.mockRejectedValueOnce(
      errors.rateLimited(HOTEL_FORM_ERRORS.writeLimit, 30),
    );
    const refused = await refusalOf(
      save(built, "rooms", { answers: {}, expectedVersion: 0, noChanges: false }),
    );
    expect(refused).toBeInstanceOf(AppError);
    expect(refused?.status).toBe(429);
    expect(built.lock).not.toHaveBeenCalled();
  });
});
