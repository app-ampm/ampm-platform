import {
  AppError,
  HOTEL_FORM_ERRORS,
  errors,
  hotelFormReadOnlyDetails,
  hotelFormSectionConflictDetails,
  hotelFormSectionTooLargeDetails,
  hotelFormSessionError,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import { saveRefusalOf } from "./section-save";

/* A refused section save, read as the page treats it (D-190 §3 and §5). */

const THEIRS = {
  section: "rooms" as const,
  version: 4,
  answers: { totalRooms: 44 },
  noChanges: false,
  editedBy: "Synthetic Colleague",
  editedAt: "2026-11-26T09:58:00.000Z",
};

describe("a refused section save", () => {
  it("offers a colleague's save of this section, read through its own draft", () => {
    const error = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionConflict,
      hotelFormSectionConflictDetails(THEIRS),
    );
    expect(saveRefusalOf(error, "rooms")).toEqual({ kind: "conflict", theirs: THEIRS });
    // A conflict on another section is not this page's to offer.
    expect(saveRefusalOf(error, "venues").kind).toBe("failed");
  });

  it("is locked once submitted, with who submitted and when, even when the words say complete", () => {
    const readOnly = {
      status: "submitted" as const,
      submittedBy: "Synthetic Colleague",
      submittedAt: "2026-11-26T09:59:00.000Z",
    };
    const error = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.readOnly,
      hotelFormReadOnlyDetails(readOnly),
    );
    expect(saveRefusalOf(error, "rooms")).toEqual({ kind: "locked", readOnly });
    expect(saveRefusalOf(new AppError("conflict", HOTEL_FORM_ERRORS.readOnly), "rooms")).toEqual({
      kind: "locked",
      readOnly: null,
    });
  });

  it("waits for a new code when the session ended or timed out", () => {
    expect(saveRefusalOf(hotelFormSessionError("session_expired"), "rooms")).toEqual({
      kind: "session",
    });
    expect(saveRefusalOf(hotelFormSessionError("link_changed"), "rooms")).toEqual({
      kind: "session",
    });
  });

  it("waits out a 429's Retry-After in the API's words", () => {
    const error = new AppError("rate_limited", HOTEL_FORM_ERRORS.writeLimit, undefined, 429, 12);
    expect(saveRefusalOf(error, "rooms")).toEqual({
      kind: "wait",
      message: HOTEL_FORM_ERRORS.writeLimit,
      seconds: 12,
    });
  });

  it("says a section is too long with the cap it is over", () => {
    const error = new AppError(
      "validation_failed",
      HOTEL_FORM_ERRORS.sectionTooLarge,
      hotelFormSectionTooLargeDetails("rooms"),
    );
    expect(saveRefusalOf(error, "rooms")).toEqual({
      kind: "failed",
      message: `${HOTEL_FORM_ERRORS.sectionTooLarge} Keep this section under 96 KB`,
    });
  });

  it("words a lost connection or a crash itself, never raw", () => {
    expect(saveRefusalOf(new AppError("network_error", "fetch failed"), "rooms")).toEqual({
      kind: "failed",
      message: HOTEL_FORM_COPY.errors.network,
    });
    expect(saveRefusalOf(errors.internal(), "rooms")).toEqual({
      kind: "failed",
      message: HOTEL_FORM_COPY.errors.unexpected,
    });
    expect(saveRefusalOf(new Error("boom"), "rooms")).toEqual({
      kind: "failed",
      message: HOTEL_FORM_COPY.errors.unexpected,
    });
    expect(
      saveRefusalOf(new AppError("unavailable", HOTEL_FORM_ERRORS.writesUnavailable), "rooms"),
    ).toEqual({ kind: "failed", message: HOTEL_FORM_ERRORS.writesUnavailable });
  });
});
