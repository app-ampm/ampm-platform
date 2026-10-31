import { leadEnquiryRequest } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { FormFields } from "./enquiry-fields";
import { fieldErrors, toPayload } from "./enquiry-payload";

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
  it("drops empty fields, keeps the demo and consent flags, coerces guests, and sends a bot token", () => {
    const payload = toPayload(
      fields({
        name: "Alice",
        phone: "9876500000",
        requestedDemo: true,
        consentMarketing: true,
        guestEstimate: "120",
      }),
    );
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBe("9876500000");
    expect(payload.requestedDemo).toBe(true);
    expect(payload.consentMarketing).toBe(true);
    expect(payload.guestEstimate).toBe(120);
    expect(payload.botToken).toBe("dev-bot-check");
  });

  it("produces a payload the shared enquiry schema accepts", () => {
    const parsed = leadEnquiryRequest.safeParse(
      toPayload(fields({ name: "Alice", phone: "9876500000" })),
    );
    expect(parsed.success).toBe(true);
  });
});

describe("fieldErrors", () => {
  it("names the email and phone fields when neither is given", () => {
    const result = leadEnquiryRequest.safeParse(toPayload(fields({ name: "Alice" })));
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrors(result.error);
    expect(errors.email).toBeTruthy();
    expect(errors.phone).toBeTruthy();
  });
});
