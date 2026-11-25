import {
  AppError,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SESSION_REFUSAL_MESSAGES,
  errors,
  hotelFormSessionError,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { refusalOf, saveOutcomeOf } from "./refusal";

/* What the page does with each refusal of the form's routes (D-189 §3 to §5). */

describe("a refused call", () => {
  it("ends at HF-08 when the link is not active, or the mode answers every route with 404", () => {
    expect(refusalOf(errors.notFound(HOTEL_FORM_ERRORS.notActive))).toEqual({
      kind: "gone",
      message: HOTEL_FORM_ERRORS.notActive,
    });
    expect(refusalOf(errors.notFound())).toEqual({ kind: "gone", message: null });
  });

  it("ends at HF-08 when AMPM replaced the link or removed the person, in the API's words", () => {
    for (const reason of ["link_changed", "person_removed", "not_active"] as const)
      expect(refusalOf(hotelFormSessionError(reason))).toEqual({
        kind: "gone",
        message: HOTEL_FORM_SESSION_REFUSAL_MESSAGES[reason],
      });
  });

  it("asks for a new code in place when the session ended, timed out or is not known", () => {
    for (const reason of ["no_session", "session_ended", "session_expired"] as const)
      expect(refusalOf(hotelFormSessionError(reason))).toEqual({
        kind: "new_code",
        message: HOTEL_FORM_SESSION_REFUSAL_MESSAGES[reason],
      });
  });

  it("counts down a 429 or 503 that says how long to wait, in the API's words", () => {
    const tooSoon = new AppError("rate_limited", HOTEL_FORM_ERRORS.tooSoon, undefined, 429, 27);
    expect(refusalOf(tooSoon)).toEqual({
      kind: "wait",
      message: HOTEL_FORM_ERRORS.tooSoon,
      seconds: 27,
    });
    expect(refusalOf(errors.unavailable(HOTEL_FORM_ERRORS.smsCapReached, 3600))).toEqual({
      kind: "wait",
      message: HOTEL_FORM_ERRORS.smsCapReached,
      seconds: 3600,
    });
  });

  it("words the limiter's own 429 for a person, still counting it down", () => {
    expect(refusalOf(errors.rateLimited("Too many requests", 12))).toEqual({
      kind: "wait",
      message: HOTEL_FORM_COPY.errors.tooMany,
      seconds: 12,
    });
  });

  it("asks for a reload when the notice changed under the page", () => {
    expect(refusalOf(errors.conflict(HOTEL_FORM_ERRORS.noticeStale))).toEqual({
      kind: "reload",
      message: HOTEL_FORM_ERRORS.noticeStale,
    });
  });

  it("puts a field's refusal on its field, the bot check's included", () => {
    const refused = errors.validation([{ path: "botToken", message: HOTEL_FORM_ERRORS.botCheck }]);
    expect(refusalOf(refused)).toEqual({
      kind: "field",
      field: "botToken",
      message: HOTEL_FORM_ERRORS.botCheck,
    });
  });

  it("puts a refused code on the code field: verify's 401 names no session reason", () => {
    expect(refusalOf(errors.unauthenticated(HOTEL_FORM_ERRORS.invalidCode))).toEqual({
      kind: "field",
      field: "oneTimeCode",
      message: HOTEL_FORM_ERRORS.invalidCode,
    });
  });

  it("shows every other refusal of the form in the API's words", () => {
    for (const message of [
      HOTEL_FORM_ERRORS.peopleFull,
      HOTEL_FORM_ERRORS.closedToNewPeople,
      HOTEL_FORM_ERRORS.mobileRemoved,
      HOTEL_FORM_ERRORS.readOnly,
    ])
      expect(refusalOf(new AppError("conflict", message))).toEqual({ kind: "message", message });
  });

  it("words a lost connection and a failure of the API for a person, never as raw text", () => {
    expect(refusalOf(errors.network())).toEqual({
      kind: "message",
      message: HOTEL_FORM_COPY.errors.network,
    });
    expect(refusalOf(errors.internal("TypeError: x is undefined"))).toEqual({
      kind: "message",
      message: HOTEL_FORM_COPY.errors.unexpected,
    });
    expect(refusalOf(new Error("parse failed"))).toEqual({
      kind: "message",
      message: HOTEL_FORM_COPY.errors.unexpected,
    });
  });
});

describe("saving your own details", () => {
  const NOW = Date.parse("2026-11-25T10:00:00.000Z");

  it("keeps a wait's end, so Save can count it down", () => {
    const wait = { kind: "wait", message: HOTEL_FORM_ERRORS.writeLimit, seconds: 30 } as const;
    expect(saveOutcomeOf(wait, NOW)).toEqual({
      kind: "refused",
      message: HOTEL_FORM_ERRORS.writeLimit,
      retryAt: NOW + 30_000,
    });
  });

  it("hands a refused session back to the flow, and words any other refusal as it came", () => {
    const ended = HOTEL_FORM_SESSION_REFUSAL_MESSAGES.session_ended;
    expect(saveOutcomeOf({ kind: "new_code", message: ended }, NOW)).toEqual({ kind: "session" });
    expect(saveOutcomeOf({ kind: "gone", message: null }, NOW)).toEqual({ kind: "session" });
    const readOnly = { kind: "message", message: HOTEL_FORM_ERRORS.readOnly } as const;
    expect(saveOutcomeOf(readOnly, NOW)).toEqual({
      kind: "refused",
      message: HOTEL_FORM_ERRORS.readOnly,
      retryAt: null,
    });
  });
});
