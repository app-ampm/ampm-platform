import { errors, HOTEL_FORM_ERRORS, HOTEL_FORM_NOTICE_VERSION } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { hashDestination } from "../../../identity/destination-hash.js";
import { oneTimeCodeMatches } from "../../../identity/one-time-code.js";
import {
  FORM_IP,
  FORM_KEYS,
  FORM_MOBILE,
  FORM_NOW,
  FORM_REQUEST_ID,
  FORM_TX,
  refusalOf,
  SMS_ENV,
} from "../testing/hotel-form-fixtures.js";
import { buildIssuer as build, issueWith as issue } from "../testing/hotel-form-issuer-harness.js";

/*
 * Issuing a hotel form code (D-189 §2 to §4): the claim is held on a new challenge, the code only as its
 * HMAC bound to the challenge; the live challenge of the same request and mobile is retired; the code goes
 * by SMS in SMS mode and to the page in on-screen mode, never both. The refusals are in
 * hotel-form-code-issuer.refusals.spec.ts; the database side in test/hotel-form-codes.e2e-spec.ts.
 */

describe("HotelFormCodeIssuer in on-screen mode", () => {
  it("answers the code for the page, with the challenge, the masked mobile and the timers", async () => {
    const built = build();
    const { result } = await issue(built);
    expect(result).toEqual({
      challengeId: built.created[0]?.id,
      maskedMobile: "+91 ••••• •1234",
      expiresAt: "2026-11-25T10:05:00.000Z",
      resendAfter: "2026-11-25T10:00:30.000Z",
      delivery: "screen",
      code: expect.stringMatching(/^\d{6}$/),
    });
    expect(built.queue).not.toHaveBeenCalled();
    expect(built.limits.allowSms).not.toHaveBeenCalled();
  });

  it("holds the claim on a new challenge and the code only as its HMAC, bound to that challenge", async () => {
    const built = build();
    const { result } = await issue(built);
    const challenge = built.created[0];
    expect(challenge).toMatchObject({
      requestId: FORM_REQUEST_ID,
      linkGeneration: 1,
      claimedFullName: "Synthetic Person",
      claimedDesignation: "General Manager",
      claimedPhone: FORM_MOBILE,
      claimedNoticeVersion: HOTEL_FORM_NOTICE_VERSION,
      delivery: "screen",
      destinationHash: hashDestination(FORM_MOBILE, FORM_KEYS.hotelFormAddress),
      codeExpiresAt: new Date("2026-11-25T10:05:00.000Z"),
      ipAddress: FORM_IP,
      userAgent: "Synthetic Browser/1.0",
    });
    const code = result.delivery === "screen" ? result.code : "";
    expect(JSON.stringify(challenge)).not.toContain(code);
    const id = String(challenge?.id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(oneTimeCodeMatches(id, code, String(challenge?.codeHmac), FORM_KEYS.hotelFormCode)).toBe(
      true,
    );
  });

  it("retires the live challenge of the same request and mobile before the new one, in one transaction", async () => {
    const built = build();
    await issue(built);
    const hash = hashDestination(FORM_MOBILE, FORM_KEYS.hotelFormAddress);
    expect(built.challenges.retireOpen).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      hash,
      FORM_NOW,
      FORM_TX,
    );
    expect(built.order).toEqual(["retireOpen", "create"]);
    expect(built.repository.transaction).toHaveBeenCalledTimes(1);
  });

  it("writes the code request as the claimant's: a hotel person's event and a guest_token audit of the challenge", async () => {
    const built = build();
    const { result, context } = await issue(built);
    const challengeId = result.challengeId;
    expect(context).toMatchObject({ hotelFormActor: { requestId: FORM_REQUEST_ID, challengeId } });
    expect(built.journal.event).toHaveBeenCalledWith(
      {
        requestId: FORM_REQUEST_ID,
        eventType: "code_requested",
        actor: { kind: "hotel_person", personId: null },
        at: FORM_NOW,
        detail: { challengeId, delivery: "screen" },
      },
      FORM_TX,
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "create",
        entityType: "hotel_info_request_challenge",
        entityId: challengeId,
        after: { id: challengeId, requestId: FORM_REQUEST_ID },
      },
      FORM_TX,
    );
  });

  it("creates or changes no person", async () => {
    const built = build({ live: true });
    await issue(built);
    expect(Object.keys(built.people)).toEqual(["wasRemoved", "findLive"]);
  });
});

describe("HotelFormCodeIssuer in SMS mode", () => {
  it("sends the code by SMS on the request's link, and never answers it", async () => {
    const built = build({ env: SMS_ENV });
    const { result } = await issue(built);
    expect(result.delivery).toBe("sms");
    expect(result).not.toHaveProperty("code");
    expect(built.queue).toHaveBeenCalledWith({
      recipientType: "external",
      recipientId: FORM_REQUEST_ID,
      recipientAddress: FORM_MOBILE,
      channel: "sms",
      eventType: "hotel_form.code",
      templateKey: "hotel_form.code",
      entityType: "hotel_info_request",
      entityId: FORM_REQUEST_ID,
      variables: { code: expect.stringMatching(/^\d{6}$/) },
      required: true,
      gateRef: "1",
    });
    expect(built.created[0]?.delivery).toBe("sms");
  });

  it("counts the code against the day's SMS cap, after every other limit", async () => {
    const built = build({ env: SMS_ENV });
    await issue(built);
    expect(built.limits.allowSms).toHaveBeenCalledWith(300, FORM_NOW);
    const [codeOrder] = built.limits.allowCodeRequest.mock.invocationCallOrder;
    const [smsOrder] = built.limits.allowSms.mock.invocationCallOrder;
    expect(Number(codeOrder)).toBeLessThan(Number(smsOrder));
  });

  it("stores nothing past the cap", async () => {
    const built = build({ env: SMS_ENV });
    built.limits.allowSms.mockRejectedValueOnce(
      errors.unavailable(HOTEL_FORM_ERRORS.smsCapReached, 60),
    );
    const refused = await refusalOf(issue(built));
    expect(refused?.status).toBe(503);
    expect(built.created).toEqual([]);
    expect(built.queue).not.toHaveBeenCalled();
  });

  it("answers 503 and retires the challenge when the SMS cannot be queued, logging neither code nor mobile", async () => {
    const built = build({ env: SMS_ENV, smsFails: true });
    const refused = await refusalOf(issue(built));
    expect(refused?.status).toBe(503);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.codesUnavailable);
    expect(built.challenges.retire).toHaveBeenCalledWith(built.created[0]?.id, FORM_NOW);
    expect(JSON.stringify(built.entries)).not.toContain("7000001234");
  });
});
