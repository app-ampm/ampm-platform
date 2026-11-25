import { randomInt } from "node:crypto";

import { HOTEL_FORM_NOTICE_VERSION, type HotelFormPolicy } from "@ampm/core";
import request from "supertest";
import { expect } from "vitest";

import { RateLimitStore, type RateLimitHit } from "../src/common/rate-limit/rate-limit.store.js";
import { ENV, loadEnv } from "../src/env.js";
import {
  NOTIFICATION_ADAPTERS,
  type NotificationAdapters,
  type NotificationDelivery,
} from "../src/modules/admin/notification/notification.adapter.js";
import {
  requestCalls,
  secretOf,
  setFormPolicy,
  startRequestSuite,
  stopRequestSuite,
  type RequestSuite,
} from "./hotel-info-requests-suite.js";

/*
 * The hotel form's e2e suites (D-189): a running API whose limiter's store the suite can clear (so a flow
 * that needs several codes for one mobile does not wait out the 30-second pause), optionally in SMS mode
 * (a provider and the form's template set, every SMS handed to a recording adapter, nothing sent), test
 * requests with their links, the public routes from a fresh network each, and the clean-up of every row
 * the suites made. Synthetic data only: reserved test mobiles (+91 70000 0XXXX), made-up names. Imported
 * by tests only.
 */

/** A fixed-window store like the in-memory one, which the suite can clear. */
export class ClearableRateLimitStore extends RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || now >= current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, resetMs: windowMs };
    }
    current.count += 1;
    return { count: current.count, resetMs: current.resetAt - now };
  }

  clear(): void {
    this.windows.clear();
  }
}

/** A suite's API, its store, and the SMS its adapter was handed (SMS mode). */
export interface FormSuite extends RequestSuite {
  readonly store: ClearableRateLimitStore;
  readonly sms: NotificationDelivery[];
}

/** An adapter for every channel that records each SMS and sends nothing. */
function recordingAdapters(sms: NotificationDelivery[]): NotificationAdapters {
  const adapter = {
    send: async (delivery: NotificationDelivery) => {
      if (delivery.channel === "sms") sms.push(delivery);
      return { providerRef: `e2e-${sms.length}` };
    },
  };
  return { for: () => adapter };
}

/**
 * Starts the API for a hotel form suite, with the form's mode at test_only. In SMS mode a provider and
 * the form's template are set (so codes go by SMS) and every line is logged, for the suite to read.
 *
 * @example
 * beforeAll(async () => (suite = await startFormSuite("e2e-hf-a-")));
 */
export async function startFormSuite(
  name: string,
  options: { readonly smsMode?: boolean } = {},
): Promise<FormSuite> {
  const store = new ClearableRateLimitStore();
  const sms: NotificationDelivery[] = [];
  const suite = await startRequestSuite(name, (builder) => {
    const withStore = builder.overrideProvider(RateLimitStore).useValue(store);
    if (!options.smsMode) return withStore;
    const env = {
      ...loadEnv(),
      SMS_PROVIDER: "msg91" as const,
      SMS_API_KEY: "e2e-synthetic-key",
      SMS_OTP_TEMPLATE: "e2e-synthetic-otp-template",
      SMS_HOTEL_FORM_TEMPLATE: "e2e-synthetic-form-template",
      LOG_LEVEL: "debug" as const,
    };
    return withStore
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(NOTIFICATION_ADAPTERS)
      .useValue(recordingAdapters(sms));
  });
  suite.app.set("trust proxy", true);
  await setFormPolicy(suite, { mode: "test_only" });
  return { ...suite, store, sms };
}

/** Sets the form's policy, test_only unless the change says otherwise. */
export function setPolicy(suite: FormSuite, policy: Partial<HotelFormPolicy>): Promise<void> {
  return setFormPolicy(suite, { mode: "test_only", ...policy });
}

let mobileSeq = randomInt(0, 5000);
/** A reserved test mobile (+91 70000 0XXXX) no other call of this run has used. */
export function freshMobile(): string {
  mobileSeq = (mobileSeq + 1) % 10_000;
  return `+91700000${String(mobileSeq).padStart(4, "0")}`;
}

let networkSeq = 0;
/** A network no other call of this run has used, from the range reserved for testing (198.18.0.0/15). */
export function freshIp(): string {
  networkSeq += 1;
  return `198.18.${Math.floor(networkSeq / 250) % 250}.${(networkSeq % 250) + 1}`;
}

/** A link the suite issued: its request and its secret. */
export interface IssuedLink {
  readonly id: string;
  readonly secret: string;
}

let hotelSeq = 0;
/** A new-hotel test request, issued by the Super Admin, with its link (what test_only admits). */
export async function testLink(suite: FormSuite): Promise<IssuedLink> {
  hotelSeq += 1;
  const response = await requestCalls(() => suite)
    .create("sa", {
      target: "new",
      proposedName: `E2E Form Hotel ${hotelSeq}`,
      proposedDestinationId: suite.destinationId,
      proposedWebAddress: `https://${suite.prefix}form-${hotelSeq}.example`,
      isTest: true,
    })
    .expect(201);
  return { id: response.body.data.request.id, secret: secretOf(response.body.data.link.url) };
}

/** The public routes, each from a fresh network unless told which. */
export function formCalls(suite: () => FormSuite) {
  const http = () => request(suite().app.getHttpServer());
  const bearer = (token: string) => `Bearer ${token}`;
  return {
    open: (token: string, ip = freshIp()) =>
      http().post("/hotel-form/open").set("X-Forwarded-For", ip).send({ token }),
    codes: (body: object, ip = freshIp()) =>
      http()
        .post("/hotel-form/codes")
        .set("X-Forwarded-For", ip)
        .set("User-Agent", "E2E Synthetic Browser/1.0")
        .send(body),
    verify: (body: object, ip = freshIp()) =>
      http().post("/hotel-form/codes/verify").set("X-Forwarded-For", ip).send(body),
    me: (token: string, ip = freshIp()) =>
      http().get("/hotel-form/me").set("X-Forwarded-For", ip).set("Authorization", bearer(token)),
    patchMe: (token: string, body: object, ip = freshIp()) =>
      http()
        .patch("/hotel-form/me")
        .set("X-Forwarded-For", ip)
        .set("Authorization", bearer(token))
        .send(body),
    signOut: (token: string, ip = freshIp()) =>
      http()
        .post("/hotel-form/sign-out")
        .set("X-Forwarded-For", ip)
        .set("Authorization", bearer(token)),
  };
}

/** A code request's body for a link and a mobile. */
export function claimFor(secret: string, mobile: string, overrides: object = {}) {
  return {
    token: secret,
    fullName: "E2E Synthetic Person",
    designation: "General Manager",
    mobile,
    noticeVersion: HOTEL_FORM_NOTICE_VERSION,
    botToken: "e2e-bot-pass",
    ...overrides,
  };
}

/**
 * Asks for a code on screen and enters it: the session token and the challenge. Clears the limiter's
 * store first, so a test may sign the same mobile in again at once.
 */
export async function signIn(
  suite: FormSuite,
  secret: string,
  mobile: string,
  overrides: object = {},
): Promise<{ readonly sessionToken: string; readonly challengeId: string }> {
  suite.store.clear();
  const calls = formCalls(() => suite);
  const issued = await calls.codes(claimFor(secret, mobile, overrides)).expect(200);
  const { challengeId, code } = issued.body.data;
  expect(code).toMatch(/^\d{6}$/);
  const verified = await calls
    .verify({ token: secret, challengeId, oneTimeCode: code })
    .expect(200);
  return { sessionToken: verified.body.data.sessionToken, challengeId };
}

/** Removes every row the hotel form wrote for the suite's requests, then what the request suite made. */
export async function stopFormSuite(suite: FormSuite): Promise<void> {
  const { prisma } = suite;
  const hotels = await prisma.hotel.findMany({
    where: { slug: { startsWith: suite.prefix } },
    select: { id: true },
  });
  const requests = await prisma.hotelInfoRequest.findMany({
    where: {
      OR: [
        { hotelId: { in: hotels.map((hotel) => hotel.id) } },
        { proposedDestinationId: suite.destinationId },
      ],
    },
    select: { id: true },
  });
  const requestIds = requests.map((row) => row.id);
  const people = await prisma.hotelInfoRequestPerson.findMany({
    where: { requestId: { in: requestIds } },
    select: { id: true },
  });
  const challenges = await prisma.hotelInfoRequestChallenge.findMany({
    where: { requestId: { in: requestIds } },
    select: { id: true },
  });
  const personIds = people.map((row) => row.id);
  const formIds = [...personIds, ...challenges.map((row) => row.id)];
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: formIds } } });
  await prisma.notification.deleteMany({ where: { templateKey: "system.hotel_form_sms_cap" } });
  await prisma.hotelInfoRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.hotelInfoRequestConsent.deleteMany({ where: { personId: { in: personIds } } });
  await prisma.hotelInfoRequestChallenge.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.hotelInfoRequestPerson.deleteMany({ where: { requestId: { in: requestIds } } });
  await stopRequestSuite(suite);
}

/**
 * How many rows of a request hold a code anywhere but its HMAC: the claim, the person, the consents, the
 * events, the audits (by their actor_ref) and the notifications, matched on whole digits so a timestamp or
 * a hash cannot match by chance.
 */
export async function rowsHoldingCode(
  suite: FormSuite,
  requestId: string,
  code: string,
): Promise<Record<string, number>> {
  const digits = `(^|[^0-9])${code}([^0-9]|$)`;
  const actorRef = `hir:${requestId}/%`;
  const [counts] = await suite.prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT
      (SELECT count(*) FROM hotel_info_request_challenges c WHERE c.request_id = ${requestId}::uuid
        AND concat_ws(' ', c.claimed_full_name, c.claimed_designation, c.claimed_phone,
          c.claimed_notice_version, c.user_agent, c.ip_address) ~ ${digits}) AS challenges,
      (SELECT count(*) FROM hotel_info_request_people p WHERE p.request_id = ${requestId}::uuid
        AND concat_ws(' ', p.full_name, p.designation, p.phone) ~ ${digits}) AS people,
      (SELECT count(*) FROM hotel_info_request_consents k
        JOIN hotel_info_request_people p ON p.id = k.person_id
        WHERE p.request_id = ${requestId}::uuid
        AND concat_ws(' ', k.text_version, k.ip_address) ~ ${digits}) AS consents,
      (SELECT count(*) FROM hotel_info_request_events e WHERE e.request_id = ${requestId}::uuid
        AND coalesce(e.detail_json::text, '') ~ ${digits}) AS events,
      (SELECT count(*) FROM audit_events a WHERE a.actor_ref LIKE ${actorRef}
        AND concat_ws(' ', a.before_json::text, a.after_json::text) ~ ${digits}) AS audits,
      (SELECT count(*) FROM notifications n WHERE n.recipient_id::text = ${requestId}
        AND concat_ws(' ', n.data::text, n.recipient_address) ~ ${digits}) AS notifications`;
  return Object.fromEntries(
    Object.entries(counts ?? {}).map(([table, count]) => [table, Number(count)]),
  );
}
