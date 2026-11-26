import { HOTEL_FORM_ERRORS, HOTEL_FORM_NOTICE_VERSION } from "@ampm/core";
import { describe, expect, it } from "vitest";

import {
  FORM_IP,
  FORM_LATER,
  FORM_MOBILE,
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  linkedRequest,
  refusalOf,
} from "../testing/hotel-form-fixtures.js";
import {
  buildVerifier as build,
  CHALLENGE_ID,
  openSession,
  STORED,
  verifyWith as verify,
} from "../testing/hotel-form-verify-harness.js";
import { hashSessionToken } from "./hotel-form-session-rules.js";

/*
 * What a right code does, in one transaction with the request's row locked (D-189 §4 and §5): find or
 * create the person (a returning one keeps their stored name and designation; a new one past maxPeople,
 * after the merge, or on a mobile AMPM removed is refused), record the privacy notice's consent, spend the
 * challenge and clear its claim, open a session (a person holds 3 at most), and write the event and the
 * audit as the person.
 */

describe("HotelFormEnrolment of a new person", () => {
  it("creates the person from the claim and answers the session, the person and the request", async () => {
    const built = build();
    const { result } = await verify(built);
    expect(built.people.create).toHaveBeenCalledWith(
      {
        requestId: FORM_REQUEST_ID,
        fullName: "Synthetic Claimant",
        designation: "Sales Manager",
        phone: FORM_MOBILE,
        at: FORM_NOW,
        delivery: "screen",
      },
      FORM_TX,
    );
    expect(result).toEqual({
      sessionToken: expect.stringMatching(/^hfs_/),
      personId: FORM_PERSON_ID,
      person: { fullName: "Synthetic Claimant", designation: "Sales Manager" },
      request: {
        displayLabel: "Monsoon refresh",
        staffNote: "Rooms first, please",
        status: "open",
        expiresAt: FORM_LATER.toISOString(),
      },
    });
  });

  it("spends the challenge on the person, opening the session by its token's hash only", async () => {
    const built = build();
    const { result } = await verify(built);
    expect(built.challenges.markUsed).toHaveBeenCalledWith(
      CHALLENGE_ID,
      {
        personId: FORM_PERSON_ID,
        sessionTokenHash: hashSessionToken(result.sessionToken),
        at: FORM_NOW,
      },
      FORM_TX,
    );
    expect(built.repository.lockForForm).toHaveBeenCalledWith(FORM_REQUEST_ID, FORM_TX);
  });

  it("records the privacy notice the claimant accepted, with their address", async () => {
    const built = build();
    await verify(built);
    expect(built.people.addNoticeConsent).toHaveBeenCalledWith(
      {
        personId: FORM_PERSON_ID,
        textVersion: HOTEL_FORM_NOTICE_VERSION,
        ipAddress: FORM_IP,
        at: FORM_NOW,
      },
      FORM_TX,
    );
  });

  it("writes a person_verified event and a guest_token audit as the person, with no personal values", async () => {
    const built = build();
    const { context } = await verify(built);
    expect(context).toMatchObject({
      hotelFormActor: { requestId: FORM_REQUEST_ID, personId: FORM_PERSON_ID },
    });
    expect(built.journal.event).toHaveBeenCalledWith(
      {
        requestId: FORM_REQUEST_ID,
        eventType: "person_verified",
        actor: { kind: "hotel_person", personId: FORM_PERSON_ID },
        at: FORM_NOW,
        detail: { challengeId: CHALLENGE_ID, delivery: "screen", returning: false },
      },
      FORM_TX,
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "create",
        entityType: "hotel_info_request_person",
        entityId: FORM_PERSON_ID,
        after: {
          id: FORM_PERSON_ID,
          requestId: FORM_REQUEST_ID,
          challengeId: CHALLENGE_ID,
          changedFields: ["fullName", "designation", "phone"],
        },
      },
      FORM_TX,
    );
  });

  it("refuses a new person past the request's maxPeople with 409, spending nothing", async () => {
    const built = build({ policy: { maxPeople: 10 }, people: 10 });
    const refused = await refusalOf(verify(built));
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.peopleFull);
    expect(built.people.create).not.toHaveBeenCalled();
    expect(built.challenges.markUsed).not.toHaveBeenCalled();
  });

  it("refuses a new person once the request is merged, while it shows its status only", async () => {
    const merged = linkedRequest({ status: "merged", statusOnlyUntil: FORM_LATER });
    const refused = await refusalOf(verify(build({ found: merged })));
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.closedToNewPeople);
  });

  it("refuses a mobile AMPM removed from the request after its code was issued", async () => {
    const refused = await refusalOf(verify(build({ removed: true })));
    expect(refused?.status).toBe(403);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.mobileRemoved);
  });
});

describe("HotelFormEnrolment of a returning person", () => {
  it("finds them by request and phone and keeps their stored name and designation", async () => {
    const built = build({ live: STORED });
    const { result } = await verify(built);
    expect(built.people.findLive).toHaveBeenCalledWith(FORM_REQUEST_ID, FORM_MOBILE, FORM_TX);
    expect(built.people.create).not.toHaveBeenCalled();
    expect(built.people.markReturning).toHaveBeenCalledWith(
      FORM_PERSON_ID,
      { at: FORM_NOW, delivery: "screen" },
      FORM_TX,
    );
    expect(result.person).toEqual({ fullName: "Stored Person", designation: "General Manager" });
    expect(built.journal.event).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { challengeId: CHALLENGE_ID, delivery: "screen", returning: true },
      }),
      FORM_TX,
    );
  });

  it("lets them in when the request is full, and after the merge", async () => {
    expect((await verify(build({ live: STORED, people: 10 }))).result.person).toEqual({
      fullName: "Stored Person",
      designation: "General Manager",
    });
    const merged = linkedRequest({ status: "merged", statusOnlyUntil: FORM_LATER });
    expect((await verify(build({ live: STORED, found: merged }))).result.request.status).toBe(
      "merged",
    );
  });
});

describe("HotelFormEnrolment's guards and sessions", () => {
  it("refuses when the request closed or its link changed while the code was typed", async () => {
    const revoked = await refusalOf(
      verify(build({ locked: linkedRequest({ status: "revoked" }) })),
    );
    expect(revoked?.status).toBe(404);
    const reissued = await refusalOf(
      verify(build({ locked: linkedRequest({ tokenGeneration: 2 }) })),
    );
    expect(reissued?.status).toBe(404);
    expect(reissued?.message).toBe(HOTEL_FORM_ERRORS.notActive);
  });

  it("refuses a challenge spent or retired meanwhile, writing nothing", async () => {
    for (const built of [build({ claim: null }), build({ used: false })]) {
      const refused = await refusalOf(verify(built));
      expect(refused?.status).toBe(401);
      expect(refused?.message).toBe(HOTEL_FORM_ERRORS.invalidCode);
      expect(built.people.addNoticeConsent).not.toHaveBeenCalled();
    }
  });

  it("ends the oldest live session when a person opens a fourth", async () => {
    const sessions = [
      openSession("new", 0),
      openSession("one", 0.5),
      openSession("two", 1),
      openSession("oldest", 1.5),
      openSession("expired", 5),
    ];
    const built = build({ live: STORED, sessions });
    await verify(built);
    expect(built.sessions.openSessionsOf).toHaveBeenCalledWith(FORM_PERSON_ID, FORM_TX);
    expect(built.sessions.endSessions).toHaveBeenCalledWith(["oldest"], FORM_NOW, FORM_TX);
  });
});
