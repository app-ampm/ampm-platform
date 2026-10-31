import { describe, expect, it } from "vitest";

import { indianPhone, leadEnquiryRequest } from "./leads.js";

describe("indianPhone", () => {
  it("normalises Indian formats to E.164 with a +91 default", () => {
    expect(indianPhone.parse("9876543210")).toBe("+919876543210");
    expect(indianPhone.parse("09876543210")).toBe("+919876543210");
    expect(indianPhone.parse("+91 98765 43210")).toBe("+919876543210");
    expect(indianPhone.parse("(0)98765-43210")).toBe("+919876543210");
    expect(indianPhone.parse("919876543210")).toBe("+919876543210");
  });

  it("accepts a valid non-Indian E.164 number unchanged", () => {
    expect(indianPhone.parse("+14155552671")).toBe("+14155552671");
  });

  it("rejects what is not a phone number", () => {
    expect(indianPhone.safeParse("12345").success).toBe(false);
    expect(indianPhone.safeParse("not a phone").success).toBe(false);
  });
});

describe("leadEnquiryRequest", () => {
  it("requires an email or a phone, naming both fields", () => {
    const result = leadEnquiryRequest.safeParse({ name: "Alice" });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toContain("email");
    expect(paths).toContain("phone");
  });

  it("accepts a phone only and normalises it", () => {
    const result = leadEnquiryRequest.parse({ name: "Alice", phone: "9876543210" });
    expect(result.phone).toBe("+919876543210");
    expect(result.email).toBeUndefined();
  });

  it("lowercases the email and defaults consent to false", () => {
    const result = leadEnquiryRequest.parse({ name: "Alice", email: "ALICE@Example.com" });
    expect(result.email).toBe("alice@example.com");
    expect(result.consentMarketing).toBe(false);
  });

  it("rejects a tentative date range that runs backwards", () => {
    const result = leadEnquiryRequest.safeParse({
      name: "Alice",
      phone: "9876543210",
      tentativeDateFrom: "2027-02-01",
      tentativeDateTo: "2027-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(leadEnquiryRequest.safeParse({ name: "Alice", email: "not-an-email" }).success).toBe(
      false,
    );
  });
});
