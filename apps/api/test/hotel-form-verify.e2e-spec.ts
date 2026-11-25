import { createHash } from "node:crypto";

import { HOTEL_FORM_ERRORS, HOTEL_FORM_NOTICE_VERSION } from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  claimFor,
  formCalls,
  freshMobile,
  rowsHoldingCode,
  setPolicy,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
} from "./hotel-form-suite.js";
import { requestCalls, secretOf } from "./hotel-info-requests-suite.js";

/*
 * Entering a hotel form code (D-189 §2 and §4), on screen against the test database: a new person is
 * created from the claim with the privacy notice's consent, the claim is cleared and a session opens, all
 * audited as the person with no personal values; a returning person keeps their stored details; five
 * wrong tries retire the code and clear its claim; the request's maxPeople and the status-only window
 * refuse a new person but not a returning one; a reissued link's challenges no longer verify; and no row
 * holds the code but its HMAC.
 */
describe("The hotel form's code verification (e2e, D-189, on screen)", () => {
  let suite: FormSuite;
  const calls = formCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-verify-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  const issue = async (secret: string, mobile: string, overrides: object = {}) => {
    suite.store.clear();
    const issued = await calls.codes(claimFor(secret, mobile, overrides)).expect(200);
    return {
      challengeId: String(issued.body.data.challengeId),
      code: String(issued.body.data.code),
    };
  };

  it("makes a new person from the claim, records the notice, clears the claim and opens a session", async () => {
    const link = await testLink(suite);
    const mobile = freshMobile();
    const { challengeId, code } = await issue(link.secret, mobile);
    const verified = await calls
      .verify({ token: link.secret, challengeId, oneTimeCode: code })
      .expect(200);
    const { sessionToken } = verified.body.data;
    expect(verified.body.data).toEqual({
      sessionToken: expect.stringMatching(/^hfs_[A-Za-z0-9_-]{43}$/),
      person: { fullName: "E2E Synthetic Person", designation: "General Manager" },
      request: {
        displayLabel: null,
        staffNote: null,
        status: "open",
        expiresAt: expect.any(String),
      },
    });
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id, phone: mobile },
    });
    expect(person).toMatchObject({
      codeDelivery: "screen",
      phoneVerifiedAt: null,
      removedAt: null,
    });
    const challenge = await suite.prisma.hotelInfoRequestChallenge.findUniqueOrThrow({
      where: { id: challengeId },
    });
    expect(challenge).toMatchObject({
      personId: person.id,
      claimedFullName: null,
      claimedDesignation: null,
      claimedPhone: null,
      claimedNoticeVersion: null,
      sessionTokenHash: createHash("sha256").update(sessionToken).digest("hex"),
      sessionEndedAt: null,
    });
    const consent = await suite.prisma.hotelInfoRequestConsent.findFirstOrThrow({
      where: { personId: person.id },
    });
    expect(consent).toMatchObject({
      kind: "privacy_notice",
      textVersion: HOTEL_FORM_NOTICE_VERSION,
      granted: true,
      revisionHash: null,
    });
  });

  it("audits the person as guest_token with their actor_ref, and writes their event", async () => {
    const link = await testLink(suite);
    await signIn(suite, link.secret, freshMobile());
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id },
    });
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: person.id },
    });
    expect(audit).toMatchObject({
      actorType: "guest_token",
      actorUserId: null,
      actorRef: `hir:${link.id}/person:${person.id}`,
      action: "create",
      entityType: "hotel_info_request_person",
    });
    expect(audit.afterJson).toEqual({
      id: person.id,
      requestId: link.id,
      challengeId: expect.any(String),
      changedFields: ["fullName", "designation", "phone"],
    });
    const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
      where: { requestId: link.id, eventType: "person_verified" },
    });
    expect(event).toMatchObject({ actorKind: "hotel_person", actorPersonId: person.id });
    expect(event.detail).toMatchObject({ delivery: "screen", returning: false });
  });

  it("keeps a returning person's stored name and designation, whatever the new claim says", async () => {
    const link = await testLink(suite);
    const mobile = freshMobile();
    await signIn(suite, link.secret, mobile);
    const again = await issue(link.secret, mobile, {
      fullName: "Someone Else",
      designation: "Other Words",
    });
    const verified = await calls
      .verify({ token: link.secret, challengeId: again.challengeId, oneTimeCode: again.code })
      .expect(200);
    expect(verified.body.data.person).toEqual({
      fullName: "E2E Synthetic Person",
      designation: "General Manager",
    });
    const people = await suite.prisma.hotelInfoRequestPerson.findMany({
      where: { requestId: link.id, phone: mobile },
    });
    expect(people).toHaveLength(1);
  });

  it("refuses five wrong tries, then retires the code and clears its claim at once", async () => {
    const link = await testLink(suite);
    const { challengeId, code } = await issue(link.secret, freshMobile());
    const wrong = code === "000000" ? "999999" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const refused = await calls
        .verify({ token: link.secret, challengeId, oneTimeCode: wrong })
        .expect(401);
      expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.invalidCode);
    }
    const burned = await suite.prisma.hotelInfoRequestChallenge.findUniqueOrThrow({
      where: { id: challengeId },
    });
    expect(burned).toMatchObject({
      attempts: 5,
      usedAt: null,
      claimedPhone: null,
      claimedFullName: null,
    });
    expect(burned.retiredAt).not.toBeNull();
    await calls.verify({ token: link.secret, challengeId, oneTimeCode: code }).expect(401);
  });

  it("refuses a new person past maxPeople with 409, and lets a returning one in", async () => {
    const link = await testLink(suite);
    await setPolicy(suite, { maxPeople: 1 });
    const first = freshMobile();
    await signIn(suite, link.secret, first);
    const newcomer = await issue(link.secret, freshMobile());
    const full = await calls
      .verify({ token: link.secret, challengeId: newcomer.challengeId, oneTimeCode: newcomer.code })
      .expect(409);
    expect(full.body.error.message).toBe(HOTEL_FORM_ERRORS.peopleFull);
    await signIn(suite, link.secret, first);
    await setPolicy(suite, {});
  });

  it("lets only returning people in during the status-only window after a merge", async () => {
    const link = await testLink(suite);
    const known = freshMobile();
    await signIn(suite, link.secret, known);
    const day = 24 * 60 * 60 * 1000;
    await suite.prisma.hotelInfoRequest.update({
      where: { id: link.id },
      data: { status: "merged", statusOnlyUntil: new Date(Date.now() + 7 * day) },
    });
    expect((await calls.open(link.secret).expect(200)).body.data.state).toBe("status_only");
    const newcomer = await issue(link.secret, freshMobile());
    const closed = await calls
      .verify({ token: link.secret, challengeId: newcomer.challengeId, oneTimeCode: newcomer.code })
      .expect(409);
    expect(closed.body.error.message).toBe(HOTEL_FORM_ERRORS.closedToNewPeople);
    await signIn(suite, link.secret, known);
  });

  it("no longer verifies a challenge of a reissued link, through the old link or the new", async () => {
    const link = await testLink(suite);
    const { challengeId, code } = await issue(link.secret, freshMobile());
    const reissued = await requestCalls(() => suite)
      .reissue("sa", link.id)
      .expect(200);
    const secret = secretOf(String(reissued.body.data.link.url));
    const old = await calls
      .verify({ token: link.secret, challengeId, oneTimeCode: code })
      .expect(404);
    expect(old.body.error.message).toBe(HOTEL_FORM_ERRORS.notActive);
    await calls.verify({ token: secret, challengeId, oneTimeCode: code }).expect(401);
  });

  it("keeps the code in no row but its HMAC, before and after it is entered", async () => {
    const link = await testLink(suite);
    const { challengeId, code } = await issue(link.secret, freshMobile());
    const none = { challenges: 0, people: 0, consents: 0, events: 0, audits: 0, notifications: 0 };
    expect(await rowsHoldingCode(suite, link.id, code)).toEqual(none);
    await calls.verify({ token: link.secret, challengeId, oneTimeCode: code }).expect(200);
    expect(await rowsHoldingCode(suite, link.id, code)).toEqual(none);
  });
});
