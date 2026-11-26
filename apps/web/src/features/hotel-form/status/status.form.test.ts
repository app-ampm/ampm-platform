import { AppError, HOTEL_FORM_ERRORS, hotelFormSessionError } from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT, EDITED_AT } from "../draft.test-fixtures";
import { momentOf } from "../hotel-form-time";
import {
  correctionCheckOf,
  hasBeenSubmitted,
  pressRefusalOf,
  submittedLineOf,
  takesCorrections,
} from "./status.form";

/* HF-07's rules (D-190 §5): who submitted, what the page offers in each state, and a correction's checks. */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(EDITED_AT));
});

afterEach(() => vi.useRealTimers());

const request = DRAFT.request;

describe("where the request stands", () => {
  it("says who submitted it and when, the time alone for a submitter who withdrew consent", () => {
    expect(submittedLineOf(request)).toBeNull();
    expect(submittedLineOf({ ...request, submittedBy: "Ravi Kumar", submittedAt: EDITED_AT })).toBe(
      `Submitted by Ravi Kumar ${momentOf(EDITED_AT)}.`,
    );
    expect(submittedLineOf({ ...request, submittedBy: null, submittedAt: EDITED_AT })).toBe(
      `Submitted ${momentOf(EDITED_AT)}.`,
    );
  });

  it("offers withdrawal once submitted, and a correction only while the answers can't be edited", () => {
    expect(hasBeenSubmitted(request)).toBe(false);
    expect(hasBeenSubmitted({ ...request, status: "submitted" })).toBe(true);
    // AMPM asked for changes after a submit: the answers are edited, not corrected.
    const changes = { ...request, status: "changes_requested" as const, submittedAt: EDITED_AT };
    expect(hasBeenSubmitted(changes)).toBe(true);
    expect(takesCorrections("changes_requested")).toBe(false);
    for (const status of ["submitted", "in_review", "merged"] as const)
      expect(takesCorrections(status)).toBe(true);
    expect(takesCorrections("open")).toBe(false);
  });
});

describe("a correction", () => {
  it("needs words, at most 2,000 characters, then a passed bot check", () => {
    expect(correctionCheckOf("  ", "token")).toEqual({
      kind: "fix",
      error: "Write what should be corrected",
    });
    expect(correctionCheckOf("x".repeat(2_001), "token")).toEqual({
      kind: "fix",
      error: "Use at most 2000 characters",
    });
    expect(correctionCheckOf("The pool closes at 9 pm.", null)).toEqual({ kind: "bot_check" });
    expect(correctionCheckOf("The pool closes at 9 pm.", "token")).toEqual({
      kind: "send",
      correction: { message: "The pool closes at 9 pm.", botToken: "token" },
    });
  });
});

describe("a refused press (a correction, a withdrawal)", () => {
  it("keeps the API's words, says a refused bot check apart and counts a cap down", () => {
    expect(pressRefusalOf(new AppError("conflict", HOTEL_FORM_ERRORS.notSubmitted))).toEqual({
      kind: "message",
      message: HOTEL_FORM_ERRORS.notSubmitted,
    });
    const bot = new AppError("validation_failed", HOTEL_FORM_ERRORS.botCheck, [
      { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck },
    ]);
    expect(pressRefusalOf(bot)).toEqual({ kind: "bot", message: HOTEL_FORM_ERRORS.botCheck });
    const capped = new AppError(
      "rate_limited",
      HOTEL_FORM_ERRORS.correctionLimit,
      undefined,
      429,
      3_600,
    );
    expect(pressRefusalOf(capped)).toEqual({
      kind: "wait",
      message: HOTEL_FORM_ERRORS.correctionLimit,
      retryAt: Date.parse(EDITED_AT) + 3_600_000,
    });
    expect(pressRefusalOf(hotelFormSessionError("session_ended"))).toEqual({ kind: "session" });
  });
});
