import {
  AppError,
  errors,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyOf,
  hotelFormSessionRefusalOf,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_EARLIER,
  formSession,
  formSubmission,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import { build, save } from "../testing/hotel-form-section-saves-fakes.js";

/*
 * What a section's autosave refuses (D-190 §3) with fakes: a request no longer open (409 readOnly, naming
 * who submitted and when), one that left the form (401 not_active), a session a withdrawal ended under the
 * lock (401 session_ended), No changes on an onboarding request,
 * a section over its cap (400 sectionTooLarge), and a save past its windows (429), each before writing.
 */

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

  it("answers 401 session_ended when the session ended under the lock since the guard ran, writing nothing", async () => {
    const built = build({ open: false });
    const refused = await refusalOf(
      save(built, "rooms", { answers: { totalRooms: 9 }, expectedVersion: 0, noChanges: false }),
    );
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("session_ended");
    expect(built.lock.mock.invocationCallOrder[0]).toBeLessThan(
      built.isOpen.mock.invocationCallOrder[0] ?? 0,
    );
    expect(built.find).not.toHaveBeenCalled();
    expect(built.createFirst).not.toHaveBeenCalled();
    expect(built.updateIf).not.toHaveBeenCalled();
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
