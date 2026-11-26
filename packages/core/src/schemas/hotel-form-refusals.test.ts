import { describe, expect, it } from "vitest";

import { AppError, errors } from "../errors";
import {
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_REFUSAL_REASON_PATH,
  HOTEL_FORM_SESSION_REFUSAL_MESSAGES,
  hotelFormSessionError,
  hotelFormSessionRefusal,
  hotelFormSessionRefusalOf,
} from "./hotel-form-refusals";

/*
 * How the hotel form refuses (D-189 §3 to §5): the messages the page shows, and the reason code a
 * session's 401 carries so the page can ask for a new code in place, or show that the link is gone.
 */
describe("the hotel form's 401 reasons", () => {
  it("names every reason a session can fail on", () => {
    expect(hotelFormSessionRefusal.options).toEqual([
      "no_session",
      "session_ended",
      "session_expired",
      "link_changed",
      "person_removed",
      "not_active",
    ]);
  });

  it("gives every reason a message, none empty", () => {
    for (const reason of hotelFormSessionRefusal.options) {
      expect(HOTEL_FORM_SESSION_REFUSAL_MESSAGES[reason].length).toBeGreaterThan(10);
    }
  });

  it("builds a 401 whose detail carries the reason, and reads it back", () => {
    const error = hotelFormSessionError("session_expired");
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(401);
    expect(error.code).toBe("unauthenticated");
    expect(error.message).toBe(HOTEL_FORM_SESSION_REFUSAL_MESSAGES.session_expired);
    expect(error.details).toEqual([
      { path: HOTEL_FORM_REFUSAL_REASON_PATH, message: "session_expired" },
    ]);
    expect(hotelFormSessionRefusalOf(error)).toBe("session_expired");
  });

  it("reads the reason from an error as the api-client rebuilds it from the envelope", () => {
    const rebuilt = new AppError("unauthenticated", "anything", [
      { path: "reason", message: "link_changed" },
    ]);
    expect(hotelFormSessionRefusalOf(rebuilt)).toBe("link_changed");
  });

  it("reads no reason from any other error, or from an unknown reason", () => {
    expect(hotelFormSessionRefusalOf(errors.unauthenticated())).toBeNull();
    expect(hotelFormSessionRefusalOf(errors.notFound())).toBeNull();
    const unknown = new AppError("unauthenticated", "x", [{ path: "reason", message: "nope" }]);
    expect(hotelFormSessionRefusalOf(unknown)).toBeNull();
    const notA401 = new AppError("forbidden", "x", [{ path: "reason", message: "not_active" }]);
    expect(hotelFormSessionRefusalOf(notA401)).toBeNull();
  });
});

describe("the hotel form's messages", () => {
  it("refuses a stale notice in D-189's words", () => {
    expect(HOTEL_FORM_ERRORS.noticeStale).toBe("The form was updated. Reload the page.");
  });

  it("has a message for every refusal of the identity step and of the form (D-190 §3)", () => {
    expect(Object.keys(HOTEL_FORM_ERRORS).sort()).toEqual(
      [
        "botCheck",
        "closedToNewPeople",
        "codesUnavailable",
        "invalidCode",
        "mobileLimit",
        "mobileLocked",
        "mobileRemoved",
        "networkLimit",
        "noticeStale",
        "notActive",
        "peopleFull",
        "readOnly",
        "requestLimit",
        "smsCapReached",
        "tooSoon",
        "writeLimit",
        "writesUnavailable",
        "sectionConflict",
        "sectionTooLarge",
        "submitIncomplete",
        "alreadySubmitted",
        "correctionLimit",
        "notSubmitted",
        "noChangesOnOnboarding",
      ].sort(),
    );
  });

  it("refuses a change to a submitted, reviewed or merged request in words true of all three", () => {
    expect(HOTEL_FORM_ERRORS.readOnly).not.toMatch(/complete/i);
    expect(HOTEL_FORM_ERRORS.readOnly).toMatch(/submitted/i);
    expect(HOTEL_FORM_ERRORS.readOnly).toMatch(/correction/i);
  });

  it("tells a person whose change could not be counted that it was not saved, not that codes failed", () => {
    expect(HOTEL_FORM_ERRORS.writesUnavailable).not.toBe(HOTEL_FORM_ERRORS.codesUnavailable);
    expect(HOTEL_FORM_ERRORS.writesUnavailable).not.toMatch(/code/i);
  });

  it("words each of the form's refusals apart, so the page never confuses two of them", () => {
    const form = [
      HOTEL_FORM_ERRORS.sectionConflict,
      HOTEL_FORM_ERRORS.sectionTooLarge,
      HOTEL_FORM_ERRORS.submitIncomplete,
      HOTEL_FORM_ERRORS.alreadySubmitted,
      HOTEL_FORM_ERRORS.correctionLimit,
      HOTEL_FORM_ERRORS.notSubmitted,
      HOTEL_FORM_ERRORS.noChangesOnOnboarding,
      HOTEL_FORM_ERRORS.readOnly,
    ];
    expect(new Set(form).size).toBe(form.length);
    for (const message of form) expect(message.length).toBeGreaterThan(20);
    // A correction is a message for AMPM; the limit says when another may go.
    expect(HOTEL_FORM_ERRORS.correctionLimit).toMatch(/tomorrow|later/i);
  });
});
