import { HOTEL_FORM_DISPLAY_VERSION, HOTEL_FORM_ERRORS, hotelFormReadOnlyOf } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { FORM_IP, refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_COLLEAGUE_ID,
  FORM_EARLIER,
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REFERENCE,
  FORM_REVISION_ID,
  FORM_TX,
  formSession,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import {
  BODY,
  buildSubmission as build,
  COMPLETE,
  expectNothingWritten,
  revisionHashOf,
} from "../testing/hotel-form-submission-fakes.js";
import type { RevisionRow } from "./hotel-form-submissions.repository.js";

/*
 * A submit on a request that is no longer open (D-190 §3). It is a repeat of the submit that locked the
 * request, answered with that submit's answer and writing nothing, when the request still awaits review
 * (submitted), its sections still hash to the latest revision and stand at the versions the caller's review
 * page read, and the declarations it carries are the ones recorded with that revision: a double click, or a
 * colleague who agrees. Anything else is 409
 * alreadySubmitted, saying who submitted and when: AMPM moved the request on (in review, merged), or the
 * caller's declarations differ, so theirs are never silently dropped as if recorded.
 */

describe("HotelFormSubmission: a repeat, and alreadySubmitted", () => {
  const latest: RevisionRow = {
    id: FORM_REVISION_ID,
    revision: 1,
    answersHash: revisionHashOf(COMPLETE),
    submittedByPersonId: FORM_PERSON_ID,
    submittedAt: FORM_EARLIER,
  };
  const same = {
    reference: FORM_REFERENCE,
    status: "submitted",
    submittedAt: FORM_EARLIER.toISOString(),
  };

  it("answers a double click with the first answer, writing nothing and asking no bot check", async () => {
    const built = build({ locked: submittedRequest(), latest });
    const locked = formSession({ state: "locked" });
    expect(await built.service.submit(locked, BODY, FORM_IP, FORM_NOW)).toEqual(same);
    expect(built.verify).not.toHaveBeenCalled();
    expectNothingWritten(built);
  });

  it("answers the same to a double click whose second pass the provider refuses (a spent token)", async () => {
    // Both clicks passed the guard while the request was open; the second waited on the lock.
    const built = build({ locked: submittedRequest(), latest, human: false });
    expect(await built.service.submit(formSession(), BODY, FORM_IP, FORM_NOW)).toEqual(same);
    expectNothingWritten(built);
  });

  it("answers the same to a colleague who submits with the same declarations", async () => {
    const built = build({ locked: submittedRequest(), latest });
    const colleague = formSession({ personId: FORM_COLLEAGUE_ID, state: "locked" });
    expect(await built.service.submit(colleague, BODY, FORM_IP, FORM_NOW)).toEqual(same);
    expect(built.declarationsOf).toHaveBeenCalledWith(FORM_PERSON_ID, latest.answersHash, FORM_TX);
  });

  it("refuses a submit whose 7.5 differs from the one recorded with 409 alreadySubmitted", async () => {
    const built = build({ locked: submittedRequest(), latest });
    const no = {
      ...BODY,
      display: { answer: "no" as const, textVersion: HOTEL_FORM_DISPLAY_VERSION },
    };
    const refused = await refusalOf(
      built.service.submit(formSession({ state: "locked" }), no, FORM_IP, FORM_NOW),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
    expect(refused && hotelFormReadOnlyOf(refused)).toEqual({
      status: "submitted",
      submittedBy: "Synthetic Person",
      submittedAt: FORM_EARLIER.toISOString(),
    });
    expectNothingWritten(built);
  });

  it("refuses with 409 alreadySubmitted once AMPM moved the request on: in review, merged", async () => {
    for (const status of ["in_review", "merged"] as const) {
      const built = build({
        locked: submittedRequest({ status, statusOnlyUntil: new Date("2026-12-01T00:00:00Z") }),
        latest,
      });
      const refused = await refusalOf(
        built.service.submit(formSession({ state: "locked" }), BODY, FORM_IP, FORM_NOW),
      );
      expect(refused?.message).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
      expect(refused && hotelFormReadOnlyOf(refused)?.status).toBe(status);
      expectNothingWritten(built);
    }
  });

  it("refuses with 409 alreadySubmitted a repeat whose review page read other versions of the sections", async () => {
    const built = build({ locked: submittedRequest(), latest });
    const stale = { ...BODY, sectionVersions: { ...BODY.sectionVersions, contact: 0 } };
    const refused = await refusalOf(
      built.service.submit(formSession({ state: "locked" }), stale, FORM_IP, FORM_NOW),
    );
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
    expect(built.declarationsOf).not.toHaveBeenCalled();
    expectNothingWritten(built);
  });

  it("refuses with 409 alreadySubmitted when the sections no longer hash to the submitted revision", async () => {
    const other = { ...latest, answersHash: "0".repeat(64) };
    const built = build({ locked: submittedRequest(), latest: other });
    const refused = await refusalOf(
      built.service.submit(formSession({ state: "locked" }), BODY, FORM_IP, FORM_NOW),
    );
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
  });
});
