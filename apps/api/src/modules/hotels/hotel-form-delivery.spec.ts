import { CONFIG_REGISTRY, createMemoryLogger } from "@ampm/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FakeNotificationRepository, makeService } from "../../../test/notification-fakes.js";
import type { AppLogger } from "../../common/logger.service.js";
import { loadEnv } from "../../env.js";
import type { ConfigService } from "../admin/config/config.service.js";
import { buildAdapters } from "../admin/notification/notification.module.js";
import type { NotificationService } from "../admin/notification/notification.service.js";
import { HotelFormEmailGate } from "./hotel-form-email-gate.js";
import { codeForPage, hotelFormCodeSms, hotelFormDeliveryFor } from "./hotel-form-delivery.js";
import type { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * How the hotel form delivers its codes (D-189 §2; plan §4.3): on screen exactly while it cannot send its
 * own SMS (no provider configured, or no SMS_HOTEL_FORM_TEMPLATE), by SMS once both are in place, with no
 * other switch. With SMS wired the code is never returned to the page, logged, or kept on the notification
 * once it is sent. Synthetic data only: reserved numbers, example hosts.
 */

const REQUEST_ID = "0196a0b0-0000-7000-8000-00000000d001";
const MOBILE = "+919000000001";
const CODE = "048213";

const development = {
  DATABASE_URL: "postgres://localhost:5432/ampm",
  IDENTITY_PROVIDER: "local",
  // Built at run time, so no secret-looking literal sits in the repository.
  IDENTITY_LOCAL_SECRET: "l".repeat(40),
};
/** A provider wired as client sign-in needs it (D-147). */
const provider = {
  SMS_PROVIDER: "2factor",
  SMS_API_KEY: "s".repeat(24),
  SMS_SENDER_ID: "AMPMVS",
  SMS_OTP_TEMPLATE: "1707000000000000001",
};
const HOTEL_FORM_TEMPLATE = "1707000000000000002";

describe("hotelFormDeliveryFor", () => {
  it("reads SMS_HOTEL_FORM_TEMPLATE, which is optional and never blank", () => {
    expect(loadEnv(development).SMS_HOTEL_FORM_TEMPLATE).toBeUndefined();
    const set = loadEnv({ ...development, SMS_HOTEL_FORM_TEMPLATE: HOTEL_FORM_TEMPLATE });
    expect(set.SMS_HOTEL_FORM_TEMPLATE).toBe(HOTEL_FORM_TEMPLATE);
    expect(() => loadEnv({ ...development, SMS_HOTEL_FORM_TEMPLATE: "" })).toThrow(
      /SMS_HOTEL_FORM_TEMPLATE/,
    );
  });

  it("shows codes on screen while no SMS provider is configured, template or not", () => {
    expect(hotelFormDeliveryFor(loadEnv(development))).toBe("screen");
    const templateOnly = { ...development, SMS_HOTEL_FORM_TEMPLATE: HOTEL_FORM_TEMPLATE };
    expect(hotelFormDeliveryFor(loadEnv(templateOnly))).toBe("screen");
  });

  it("keeps them on screen when client sign-in wired the provider but the form has no template", () => {
    expect(hotelFormDeliveryFor(loadEnv({ ...development, ...provider }))).toBe("screen");
  });

  it("turns to SMS by itself once the provider and the template are both in place", () => {
    const wired = { ...development, ...provider, SMS_HOTEL_FORM_TEMPLATE: HOTEL_FORM_TEMPLATE };
    expect(hotelFormDeliveryFor(loadEnv(wired))).toBe("sms");
    const msg91 = {
      ...development,
      SMS_PROVIDER: "msg91",
      SMS_API_KEY: "s".repeat(24),
      SMS_OTP_TEMPLATE: "tmpl-otp",
      SMS_HOTEL_FORM_TEMPLATE: "tmpl-hf",
    };
    expect(hotelFormDeliveryFor(loadEnv(msg91))).toBe("sms");
  });
});

describe("codeForPage", () => {
  it("gives the page the code in on-screen mode", () => {
    expect(codeForPage("screen", CODE)).toEqual({ delivery: "screen", code: CODE });
  });

  it("never gives the page the code in SMS mode", () => {
    const shown = codeForPage("sms", CODE);
    expect(shown).toEqual({ delivery: "sms" });
    expect(JSON.stringify(shown)).not.toContain(CODE);
  });
});

describe("hotelFormCodeSms", () => {
  it("is a required external SMS to the mobile, about the request, naming its link's generation", () => {
    expect(
      hotelFormCodeSms({ requestId: REQUEST_ID, linkGeneration: 3, mobile: MOBILE, code: CODE }),
    ).toEqual({
      recipientType: "external",
      recipientId: REQUEST_ID,
      recipientAddress: MOBILE,
      channel: "sms",
      eventType: "hotel_form.code",
      templateKey: "hotel_form.code",
      entityType: "hotel_info_request",
      entityId: REQUEST_ID,
      variables: { code: CODE },
      required: true,
      gateRef: "3",
    });
  });

  it("is what the send gate admits for a live request on that link, and drops after a reissue", async () => {
    const sms = hotelFormCodeSms({
      requestId: REQUEST_ID,
      linkGeneration: 1,
      mobile: MOBILE,
      code: CODE,
    });
    const gated = {
      templateKey: sms.templateKey,
      recipientType: sms.recipientType,
      recipientId: sms.recipientId,
      channel: sms.channel,
      entityType: sms.entityType ?? null,
      entityId: sms.entityId ?? null,
      gateRef: sms.gateRef ?? null,
    };
    const gateFor = (tokenGeneration: number) => {
      const policy = { ...CONFIG_REGISTRY["hotel_form.policy"].default, mode: "on" as const };
      const state = {
        isTest: false,
        status: "open" as const,
        tokenGeneration,
        statusOnlyUntil: null,
      };
      return new HotelFormEmailGate(
        { registerSendGate: vi.fn() } as unknown as NotificationService,
        { getFresh: vi.fn(async () => policy) } as unknown as ConfigService,
        { sendGateState: vi.fn(async () => state) } as unknown as HotelInfoRequestsRepository,
      );
    };
    expect(await gateFor(1).admits(gated)).toBe(true);
    expect(await gateFor(2).admits(gated)).toBe(false);
  });
});

describe("a code sent with SMS wired (D-189 §2: never returned, logged or kept)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("goes to the provider on the form's DLT template, and leaves no copy behind", async () => {
    const providerCalls: RequestInit[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      providerCalls.push(init ?? {});
      return new Response(JSON.stringify({ Status: "Success", Details: "hf-sent-1" }), {
        status: 200,
      });
    });
    const env = loadEnv({
      ...development,
      ...provider,
      SMS_HOTEL_FORM_TEMPLATE: HOTEL_FORM_TEMPLATE,
    });
    const { logger, entries } = createMemoryLogger();
    const sms = buildAdapters(env, logger as unknown as AppLogger).for("sms");
    const repo = new FakeNotificationRepository();
    const result = await makeService(repo, { adapter: sms }).queue(
      hotelFormCodeSms({ requestId: REQUEST_ID, linkGeneration: 1, mobile: MOBILE, code: CODE }),
    );
    if (result.suppressed) throw new Error("a required code must not be suppressed");

    const form = new URLSearchParams(String(providerCalls[0]?.body));
    expect(form.get("ctid")).toBe(HOTEL_FORM_TEMPLATE);
    expect(form.get("to")).toBe("919000000001");
    expect(form.get("msg")).toBe(
      `${CODE} is your AMPM verification code for the hotel information form. It is valid for 5 minutes. Do not share it. -AMPM`,
    );
    // Sent, then cleared: the row keeps neither the code (its render data) nor the mobile.
    expect(repo.rows.get(result.notificationId)).toMatchObject({
      status: "sent",
      data: null,
      recipientAddress: null,
    });
    expect(entries.map((entry) => entry.event)).toContain("notification.sms_sent");
    expect(JSON.stringify(entries)).not.toContain(CODE);
    expect(JSON.stringify(entries)).not.toContain("9000000001");
  });
});
