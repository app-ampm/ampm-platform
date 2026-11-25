import { createHash, randomBytes } from "node:crypto";

import { HOTEL_FORM_ERRORS } from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashDestination } from "../src/identity/destination-hash.js";
import { oneTimeCodeMatches } from "../src/identity/one-time-code.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../src/identity/sign-in-keys.js";
import {
  claimFor,
  formCalls,
  freshIp,
  freshMobile,
  setPolicy,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
  type IssuedLink,
} from "./hotel-form-suite.js";
import { requestCalls } from "./hotel-info-requests-suite.js";

/*
 * The hotel form's public routes before a code (D-189 §2 to §4), in on-screen mode against the test
 * database: 404 on every route while the mode is off, test_only admitting test requests only, the states a
 * link opens to with nothing about the hotel, and a code request: the claim held on a challenge, the code
 * answered for the page and stored only as its HMAC, audited as the claimant; and its refusals (a stale
 * notice, the bot check, a removed mobile, a locked mobile, the network's limit).
 */
describe("The hotel form's code requests (e2e, D-189, on screen)", () => {
  let suite: FormSuite;
  let link: IssuedLink;
  let keys: SignInKeys;
  const calls = formCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-codes-");
    keys = suite.app.get<SignInKeys>(SIGN_IN_KEYS);
    link = await testLink(suite);
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  it("answers 404 on every route while the mode is off", async () => {
    await setPolicy(suite, { mode: "off" });
    const token = `hfs_${"a".repeat(43)}`;
    await calls.open(link.secret).expect(404);
    await calls.codes(claimFor(link.secret, freshMobile())).expect(404);
    await calls
      .verify({ token: link.secret, challengeId: link.id, oneTimeCode: "123456" })
      .expect(404);
    await calls.me(token).expect(404);
    await calls.patchMe(token, { fullName: "X" }).expect(404);
    await calls.signOut(token).expect(404);
    await setPolicy(suite, {});
  });

  it("answers 404 while the mode is off before any body is read, so a malformed one learns nothing", async () => {
    await setPolicy(suite, { mode: "off" });
    const empty = await calls.codes({}).expect(404);
    expect(empty.body.error).toEqual({ code: "not_found", message: "Not found" });
    await calls.verify({}).expect(404);
    await calls.open("").expect(404);
    await calls.patchMe(`hfs_${"a".repeat(43)}`, { fullName: 42 }).expect(404);
    await setPolicy(suite, {});
  });

  it("admits only test requests under test_only, and every request when on", async () => {
    const real = await requestCalls(() => suite)
      .create("ht", { target: "existing", hotelId: suite.hotelId })
      .expect(201);
    const secret = String(real.body.data.link.url).split("#k=")[1] ?? "";
    expect((await calls.open(secret).expect(200)).body.data.state).toBe("not_active");
    await calls.codes(claimFor(secret, freshMobile())).expect(404);
    await setPolicy(suite, { mode: "on" });
    expect((await calls.open(secret).expect(200)).body.data.state).toBe("ready");
    await setPolicy(suite, {});
  });

  it("opens a test link to its state, expiry and help contact, and nothing about the hotel", async () => {
    await setPolicy(suite, { helpContact: "AMPM hotel desk (synthetic), +91 70000 09999" });
    const opened = await calls.open(link.secret).expect(200);
    expect(opened.body.data).toEqual({
      state: "ready",
      expiresAt: expect.any(String),
      helpContact: "AMPM hotel desk (synthetic), +91 70000 09999",
    });
    const unknown = await calls.open(`hfl_${randomBytes(32).toString("base64url")}`).expect(200);
    expect(unknown.body.data).toEqual({
      state: "not_active",
      expiresAt: null,
      helpContact: "AMPM hotel desk (synthetic), +91 70000 09999",
    });
    expect((await calls.open("not-a-link").expect(200)).body.data.state).toBe("not_active");
    await setPolicy(suite, {});
  });

  it("issues a code on screen: the claim on a challenge, the code only as its HMAC", async () => {
    const mobile = freshMobile();
    const answer = await calls.codes(claimFor(link.secret, mobile)).expect(200);
    const { challengeId, code } = answer.body.data;
    expect(answer.body.data).toEqual({
      challengeId: expect.any(String),
      maskedMobile: `+91 ••••• •${mobile.slice(-4)}`,
      expiresAt: expect.any(String),
      resendAfter: expect.any(String),
      delivery: "screen",
      code: expect.stringMatching(/^\d{6}$/),
    });
    const row = await suite.prisma.hotelInfoRequestChallenge.findUniqueOrThrow({
      where: { id: challengeId },
    });
    expect(row).toMatchObject({
      requestId: link.id,
      linkGeneration: 1,
      claimedFullName: "E2E Synthetic Person",
      claimedDesignation: "General Manager",
      claimedPhone: mobile,
      delivery: "screen",
      destinationHash: hashDestination(mobile, keys.hotelFormAddress),
      attempts: 0,
      usedAt: null,
      userAgent: "E2E Synthetic Browser/1.0",
    });
    expect(row.codeHmac).not.toContain(code);
    expect(oneTimeCodeMatches(challengeId, code, row.codeHmac, keys.hotelFormCode)).toBe(true);
    const sms = await suite.prisma.notification.count({
      where: { recipientId: link.id, templateKey: "hotel_form.code" },
    });
    expect(sms).toBe(0);
  });

  it("records the code request as the claimant: a hotel person's event and a guest_token audit", async () => {
    const answer = await calls.codes(claimFor(link.secret, freshMobile())).expect(200);
    const { challengeId } = answer.body.data;
    const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
      where: {
        requestId: link.id,
        eventType: "code_requested",
        detail: { path: ["challengeId"], equals: challengeId },
      },
    });
    expect(event).toMatchObject({
      actorKind: "hotel_person",
      actorPersonId: null,
      actorUserId: null,
    });
    expect(event.detail).toEqual({ challengeId, delivery: "screen" });
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityId: challengeId },
    });
    expect(audit).toMatchObject({
      actorType: "guest_token",
      actorUserId: null,
      actorRef: `hir:${link.id}/challenge:${challengeId}`,
      action: "create",
      entityType: "hotel_info_request_challenge",
    });
    expect(audit.afterJson).toEqual({ id: challengeId, requestId: link.id });
  });

  it("refuses a stale notice, a missing bot token and a mobile that is not Indian", async () => {
    const stale = await calls
      .codes(claimFor(link.secret, freshMobile(), { noticeVersion: "hf-notice-2020-01-01" }))
      .expect(409);
    expect(stale.body.error.message).toBe("The form was updated. Reload the page.");
    const bot = await calls
      .codes(claimFor(link.secret, freshMobile(), { botToken: "" }))
      .expect(400);
    expect(bot.body.error.details).toEqual([
      { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck },
    ]);
    await calls.codes(claimFor(link.secret, "+44 7700 900123")).expect(400);
  });

  it("refuses a mobile AMPM removed from the request, issuing no code", async () => {
    const mobile = freshMobile();
    await signIn(suite, link.secret, mobile);
    await suite.prisma.hotelInfoRequestPerson.updateMany({
      where: { requestId: link.id, phone: mobile },
      data: { removedAt: new Date() },
    });
    suite.store.clear();
    const before = await suite.prisma.hotelInfoRequestChallenge.count({
      where: { requestId: link.id },
    });
    const refused = await calls.codes(claimFor(link.secret, mobile)).expect(403);
    expect(refused.body.error.message).toBe(HOTEL_FORM_ERRORS.mobileRemoved);
    expect(
      await suite.prisma.hotelInfoRequestChallenge.count({ where: { requestId: link.id } }),
    ).toBe(before);
  });

  it("locks a mobile on a link for an hour after three burned codes, with Retry-After", async () => {
    const mobile = freshMobile();
    const destinationHash = hashDestination(mobile, keys.hotelFormAddress);
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
    for (const minutes of [5, 15, 25]) {
      await suite.prisma.hotelInfoRequestChallenge.create({
        data: {
          requestId: link.id,
          linkGeneration: 1,
          delivery: "screen",
          destinationHash,
          codeHmac: createHash("sha256").update(randomBytes(16)).digest("hex"),
          codeExpiresAt: minutesAgo(minutes - 3),
          attempts: 5,
          retiredAt: minutesAgo(minutes),
          createdAt: minutesAgo(minutes + 2),
        },
      });
    }
    const locked = await calls.codes(claimFor(link.secret, mobile)).expect(429);
    expect(locked.body.error.message).toBe(HOTEL_FORM_ERRORS.mobileLocked);
    expect(Number(locked.headers["retry-after"])).toBeGreaterThan(54 * 60);
    expect(Number(locked.headers["retry-after"])).toBeLessThanOrEqual(55 * 60);
    await calls.codes(claimFor(link.secret, freshMobile())).expect(200);
  });

  it("limits a network to 10 code requests a minute, failing with Retry-After", async () => {
    suite.store.clear();
    const ip = freshIp();
    for (let request = 0; request < 10; request += 1) {
      await calls.codes(claimFor(link.secret, freshMobile()), ip).expect(200);
    }
    const over = await calls.codes(claimFor(link.secret, freshMobile()), ip).expect(429);
    expect(Number(over.headers["retry-after"])).toBeGreaterThan(0);
    await calls.codes(claimFor(link.secret, freshMobile()), freshIp()).expect(200);
  });
});
