import { HOTEL_FORM_ERRORS } from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  claimFor,
  formCalls,
  freshMobile,
  rowsHoldingCode,
  setPolicy,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
  type IssuedLink,
} from "./hotel-form-suite.js";

/*
 * The hotel form's codes in SMS mode (D-189 §2 and §3): with a provider and the form's template set, the
 * code goes by SMS to the mobile and is never answered; the notification keeps neither the code nor the
 * mobile once sent; the code the SMS carried verifies and marks the mobile checked; no answer, log line
 * (logged at debug here) or stored row but the HMAC holds it; and past the day's SMS cap the code route
 * answers 503 with one in-app alert a day to the Super Admin and the Hotel team. The SMS adapter records
 * each message and sends nothing.
 */
describe("The hotel form's codes by SMS (e2e, D-189 §2 and §3)", () => {
  let suite: FormSuite;
  let link: IssuedLink;
  const lines: string[] = [];
  const calls = formCalls(() => suite);

  beforeAll(async () => {
    const capture = (...parts: unknown[]) => {
      lines.push(parts.map(String).join(" "));
    };
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation(capture);
    }
    suite = await startFormSuite("e2e-hf-sms-", { smsMode: true });
    link = await testLink(suite);
  });

  afterAll(async () => {
    await stopFormSuite(suite);
    vi.restoreAllMocks();
  });

  /** The code the last SMS to `mobile` carried. */
  const smsCodeTo = (mobile: string): string => {
    const sent = suite.sms.filter((delivery) => delivery.address === mobile).at(-1);
    expect(sent?.templateKey).toBe("hotel_form.code");
    return String(sent?.variables["code"]);
  };

  it("sends the code by SMS to the mobile, never in the answer, and keeps nothing once sent", async () => {
    const mobile = freshMobile();
    const answer = await calls.codes(claimFor(link.secret, mobile)).expect(200);
    expect(answer.body.data.delivery).toBe("sms");
    expect(answer.body.data).not.toHaveProperty("code");
    const code = smsCodeTo(mobile);
    expect(code).toMatch(/^\d{6}$/);
    expect(suite.sms.at(-1)?.content).toEqual({
      kind: "sms",
      text: expect.stringContaining(`${code} is your AMPM verification code`),
    });
    expect(JSON.stringify(answer.body)).not.toContain(code);
    const row = await suite.prisma.notification.findFirstOrThrow({
      where: { recipientId: link.id, templateKey: "hotel_form.code" },
      orderBy: { createdAt: "desc" },
    });
    expect(row).toMatchObject({
      recipientType: "external",
      channel: "sms",
      data: null,
      recipientAddress: null,
    });
    expect(["sent", "delivered"]).toContain(row.status);
  });

  it("verifies with the code the SMS carried and marks the mobile checked by SMS", async () => {
    const mobile = freshMobile();
    suite.store.clear();
    const issued = await calls.codes(claimFor(link.secret, mobile)).expect(200);
    const code = smsCodeTo(mobile);
    const verified = await calls
      .verify({ token: link.secret, challengeId: issued.body.data.challengeId, oneTimeCode: code })
      .expect(200);
    expect(JSON.stringify(verified.body)).not.toContain(code);
    const person = await suite.prisma.hotelInfoRequestPerson.findFirstOrThrow({
      where: { requestId: link.id, phone: mobile },
    });
    expect(person.codeDelivery).toBe("sms");
    expect(person.phoneVerifiedAt).not.toBeNull();
  });

  it("keeps the code in no answer, log line or stored row but its HMAC", async () => {
    const mobile = freshMobile();
    suite.store.clear();
    const from = lines.length;
    const issued = await calls.codes(claimFor(link.secret, mobile)).expect(200);
    const code = smsCodeTo(mobile);
    const { challengeId } = issued.body.data;
    // Refusals log a line each (the error filter's request.rejected): the code must be in none.
    await calls.codes(claimFor(link.secret, mobile)).expect(429);
    const wrong = code === "000000" ? "999999" : "000000";
    await calls.verify({ token: link.secret, challengeId, oneTimeCode: wrong }).expect(401);
    const verified = await calls
      .verify({ token: link.secret, challengeId, oneTimeCode: code })
      .expect(200);
    const whole = new RegExp(`(^|[^0-9])${code}([^0-9]|$)`);
    expect(whole.test(JSON.stringify([issued.body, verified.body]))).toBe(false);
    const logged = lines.slice(from);
    expect(logged.filter((line) => line.includes("request.rejected")).length).toBeGreaterThan(1);
    expect(logged.filter((line) => whole.test(line))).toEqual([]);
    expect(logged.filter((line) => line.includes(mobile.slice(-10)))).toEqual([]);
    expect(await rowsHoldingCode(suite, link.id, code)).toEqual({
      challenges: 0,
      people: 0,
      consents: 0,
      events: 0,
      audits: 0,
      notifications: 0,
    });
  });

  it("answers 503 past the day's SMS cap, alerting the Super Admin and the Hotel team once", async () => {
    await setPolicy(suite, { smsDailyCap: 2 });
    suite.store.clear();
    const alerts = () =>
      suite.prisma.notification.count({ where: { templateKey: "system.hotel_form_sms_cap" } });
    const before = await alerts();
    await calls.codes(claimFor(link.secret, freshMobile())).expect(200);
    await calls.codes(claimFor(link.secret, freshMobile())).expect(200);
    const capped = await calls.codes(claimFor(link.secret, freshMobile())).expect(503);
    expect(capped.body.error.message).toBe(HOTEL_FORM_ERRORS.smsCapReached);
    expect(Number(capped.headers["retry-after"])).toBeGreaterThan(0);
    const recipients = await suite.prisma.user.count({
      where: {
        userType: "staff",
        status: "active",
        deletedAt: null,
        roles: { some: { role: { roleKey: { in: ["super_admin", "hotel_team"] } } } },
      },
    });
    expect(recipients).toBeGreaterThan(0);
    expect((await alerts()) - before).toBe(recipients);
    await calls.codes(claimFor(link.secret, freshMobile())).expect(503);
    expect((await alerts()) - before).toBe(recipients);
    await setPolicy(suite, {});
  });
});
