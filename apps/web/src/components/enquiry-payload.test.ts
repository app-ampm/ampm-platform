import { AppError, errors, leadEnquiryRequest } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { FormFields } from "./enquiry-fields";
import { fieldErrors, sendFailureOf, submitStep, toPayload } from "./enquiry-payload";

const TOKEN = "turnstile-token";

function fields(overrides: Partial<FormFields> = {}): FormFields {
  return {
    name: "",
    email: "",
    phone: "",
    contactPreference: "",
    tentativeDateFrom: "",
    tentativeDateTo: "",
    destinationText: "",
    guestEstimate: "",
    requirements: "",
    requestedDemo: false,
    consentMarketing: false,
    ...overrides,
  };
}

describe("toPayload", () => {
  it("drops empty fields, keeps the demo and consent flags, coerces guests, and sends the bot check's token", () => {
    const payload = toPayload(
      fields({
        name: "Alice",
        phone: "9876500000",
        requestedDemo: true,
        consentMarketing: true,
        guestEstimate: "120",
      }),
      TOKEN,
    );
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBe("9876500000");
    expect(payload.requestedDemo).toBe(true);
    expect(payload.consentMarketing).toBe(true);
    expect(payload.guestEstimate).toBe(120);
    expect(payload.botToken).toBe(TOKEN);
  });

  it("sends no bot token while the check has none, never the old placeholder", () => {
    const payload = toPayload(fields({ name: "Alice", phone: "9876500000" }), null);
    expect(payload.botToken).toBeUndefined();
    expect(Object.values(payload)).not.toContain("dev-bot-check");
  });

  it("sends no reply way once the visitor goes back to Any after picking one", () => {
    const picked = fields({ name: "Alice", phone: "9876500000", contactPreference: "whatsapp" });
    expect(toPayload(picked, TOKEN).contactPreference).toBe("whatsapp");
    // The Any radio's value is "", which the form stores as typed.
    const backToAny = { ...picked, contactPreference: "" };
    expect(toPayload(backToAny, TOKEN).contactPreference).toBeUndefined();
    const parsed = leadEnquiryRequest.safeParse(toPayload(backToAny, TOKEN));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.contactPreference).toBeUndefined();
  });

  it("produces a payload the shared enquiry schema accepts", () => {
    const parsed = leadEnquiryRequest.safeParse(
      toPayload(fields({ name: "Alice", phone: "9876500000" }), TOKEN),
    );
    expect(parsed.success).toBe(true);
  });
});

describe("fieldErrors", () => {
  it("names the email and phone fields when neither is given", () => {
    const result = leadEnquiryRequest.safeParse(toPayload(fields({ name: "Alice" }), TOKEN));
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
  });
});

describe("submitStep", () => {
  const valid = fields({ name: "Alice", phone: "9876500000", guestEstimate: "80" });

  it("shows the fields' errors first, whatever the bot check is doing", () => {
    for (const token of [TOKEN, null]) {
      const step = submitStep(fields({ name: "Alice" }), token);
      expect(step.kind).toBe("invalid");
      if (step.kind === "invalid") expect(step.errors.phone).toBeTruthy();
    }
  });

  it("waits, sending nothing, while the bot check has no token", () => {
    expect(submitStep(valid, null)).toEqual({ kind: "wait" });
  });

  it("sends the parsed request with the bot check's token", () => {
    const step = submitStep(valid, TOKEN);
    expect(step.kind).toBe("send");
    if (step.kind !== "send") return;
    expect(step.request.botToken).toBe(TOKEN);
    expect(step.request.guestEstimate).toBe(80);
  });
});

describe("sendFailureOf", () => {
  it("is nothing while no send has failed", () => {
    expect(sendFailureOf(null)).toBeUndefined();
  });

  it("names too many sends", () => {
    expect(sendFailureOf(errors.rateLimited())).toBe("rate_limited");
  });

  it("names a bot-check token the API refused", () => {
    const refused = errors.validation([
      { path: "botToken", message: "Complete the bot check to continue" },
    ]);
    expect(sendFailureOf(refused)).toBe("bot_check");
  });

  it("calls everything else a plain failure", () => {
    expect(sendFailureOf(errors.validation([{ path: "email", message: "Bad email" }]))).toBe(
      "other",
    );
    expect(sendFailureOf(new AppError("validation_failed", "Validation failed"))).toBe("other");
    expect(sendFailureOf(errors.network())).toBe("other");
    expect(sendFailureOf(new Error("boom"))).toBe("other");
  });
});
