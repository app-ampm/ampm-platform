import { HOTEL_FORM_ERRORS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import {
  FORM_LATER,
  FORM_NOW,
  FORM_REQUEST_ID,
  linkedRequest,
  refusalOf,
} from "../testing/hotel-form-fixtures.js";
import {
  buildVerifier as build,
  CHALLENGE_ID,
  verifyWith as verify,
  WRONG_CODE,
} from "../testing/hotel-form-verify-harness.js";

/*
 * Trying a hotel form code (D-189 §2): a try is reserved atomically before the code is compared, so
 * guesses sent at once share the five; a refused try that spent the last (a wrong code, or a right one the
 * enrolment refused) retires the challenge at once, clearing its claim, and a try that finds none left
 * repairs a retire that failed; and every refusal of the code reads the same. Only a right code reaches the
 * enrolment (hotel-form-enrolment.service.spec.ts).
 */

describe("HotelFormCodeVerifier", () => {
  it("reserves a try before comparing, and enrols on the right code", async () => {
    const built = build();
    const { result } = await verify(built);
    expect(built.challenges.find).toHaveBeenCalledWith(CHALLENGE_ID, FORM_REQUEST_ID);
    expect(built.challenges.reserveTry).toHaveBeenCalledWith(CHALLENGE_ID, FORM_NOW);
    expect(built.challenges.retireIfSpent).not.toHaveBeenCalled();
    expect(result.sessionToken).toMatch(/^hfs_[A-Za-z0-9_-]{43}$/);
  });

  it("refuses a wrong code and retires the challenge when that try was its last", async () => {
    const built = build();
    const refused = await refusalOf(verify(built, WRONG_CODE));
    expect(refused?.status).toBe(401);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.invalidCode);
    expect(refused?.details).toBeUndefined();
    expect(built.challenges.retireIfSpent).toHaveBeenCalledWith(CHALLENGE_ID, FORM_NOW);
    expect(built.challenges.lockClaim).not.toHaveBeenCalled();
  });

  it("compares nothing once no try can be reserved: used, retired, expired or five tries spent", async () => {
    const built = build({ reserved: false });
    const refused = await refusalOf(verify(built));
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.invalidCode);
    expect(built.challenges.lockClaim).not.toHaveBeenCalled();
  });

  it("retires a challenge out of tries when no try can be reserved, repairing a retire that failed", async () => {
    const built = build({ reserved: false });
    await refusalOf(verify(built));
    expect(built.challenges.retireIfSpent).toHaveBeenCalledWith(CHALLENGE_ID, FORM_NOW);
  });

  it.each([
    ["a removed mobile", { removed: true }, 403, HOTEL_FORM_ERRORS.mobileRemoved],
    ["a full request", { people: 10 }, 409, HOTEL_FORM_ERRORS.peopleFull],
    [
      "a merged request",
      { found: linkedRequest({ status: "merged", statusOnlyUntil: FORM_LATER }) },
      409,
      HOTEL_FORM_ERRORS.closedToNewPeople,
    ],
  ] as const)(
    "retires the challenge if its tries are spent when the enrolment refuses the right code: %s",
    async (_case, options, status, message) => {
      const built = build(options);
      const refused = await refusalOf(verify(built));
      expect(refused?.status).toBe(status);
      expect(refused?.message).toBe(message);
      expect(built.challenges.retireIfSpent).toHaveBeenCalledWith(CHALLENGE_ID, FORM_NOW);
    },
  );

  it("answers the enrolment's refusal even when the retire after it fails", async () => {
    const built = build({ removed: true });
    built.challenges.retireIfSpent.mockRejectedValueOnce(new Error("connection lost"));
    const refused = await refusalOf(verify(built));
    expect(refused?.status).toBe(403);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.mobileRemoved);
  });

  it("refuses a challenge of another request, or of an older link, without spending a try", async () => {
    for (const built of [build({ challenge: null }), build({ challenge: { linkGeneration: 0 } })]) {
      const refused = await refusalOf(verify(built));
      expect(refused?.status).toBe(401);
      expect(refused?.message).toBe(HOTEL_FORM_ERRORS.invalidCode);
      expect(built.challenges.reserveTry).not.toHaveBeenCalled();
    }
  });

  it("refuses with 404 on a link that is not active, and with 404 everywhere while the mode is off", async () => {
    const closed = await refusalOf(verify(build({ found: linkedRequest({ status: "revoked" }) })));
    expect(closed?.status).toBe(404);
    expect(closed?.message).toBe(HOTEL_FORM_ERRORS.notActive);
    const off = build({ policy: { mode: "off" } });
    expect((await refusalOf(verify(off)))?.status).toBe(404);
    expect(off.challenges.find).not.toHaveBeenCalled();
  });

  it("admits only test requests in test_only", async () => {
    const real = build({ policy: { mode: "test_only" }, found: linkedRequest({ isTest: false }) });
    expect((await refusalOf(verify(real)))?.status).toBe(404);
    const test = build({ policy: { mode: "test_only" } });
    expect((await verify(test)).result.person.fullName).toBe("Synthetic Claimant");
  });
});
