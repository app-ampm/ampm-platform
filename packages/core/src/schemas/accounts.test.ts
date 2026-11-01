import { describe, expect, it } from "vitest";

import { accountClientView, accountListQuery, leadConvertRequest } from "./accounts.js";

const ID = "018f0000-0000-7000-8000-000000000000";

describe("leadConvertRequest", () => {
  it("accepts the minimal body (just the contact email) and defaults the decision-maker flag", () => {
    const parsed = leadConvertRequest.safeParse({
      primaryContact: { email: "Couple@Example.com" },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // The email is lowercased, and the primary contact is a decision maker unless told otherwise.
    expect(parsed.data.primaryContact.email).toBe("couple@example.com");
    expect(parsed.data.primaryContact.isDecisionMaker).toBe(true);
  });

  it("requires a contact email — the portal invite is delivered by email (AUTH-02)", () => {
    expect(leadConvertRequest.safeParse({ primaryContact: {} }).success).toBe(false);
    expect(leadConvertRequest.safeParse({}).success).toBe(false);
  });

  it("normalises an Indian phone number to E.164 (AC-01.3)", () => {
    const parsed = leadConvertRequest.safeParse({
      primaryContact: { email: "a@example.com", phone: "9876500000" },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.primaryContact.phone).toBe("+919876500000");
  });
});

describe("accountClientView (AC-12.3)", () => {
  const base = {
    id: ID,
    name: "The Sharmas",
    coupleNames: null,
    preferredLocations: null,
    status: "prospect",
  };

  it("accepts a client account carrying only CLIENT-class fields", () => {
    expect(accountClientView.safeParse(base).success).toBe(true);
  });

  it("rejects any restricted or internal field, so none can be serialised to a client", () => {
    expect(accountClientView.safeParse({ ...base, internalNotes: "secret" }).success).toBe(false);
    expect(accountClientView.safeParse({ ...base, billingName: "Acme Pvt Ltd" }).success).toBe(
      false,
    );
    expect(accountClientView.safeParse({ ...base, gstin: "22AAAAA0000A1Z5" }).success).toBe(false);
    expect(accountClientView.safeParse({ ...base, leadId: ID }).success).toBe(false);
    expect(accountClientView.safeParse({ ...base, isDemo: false }).success).toBe(false);
  });
});

describe("accountListQuery", () => {
  it("validates the cursor as a UUID, so a malformed cursor is a 400 at the edge, not a 500", () => {
    expect(accountListQuery.safeParse({ cursor: "not-a-uuid" }).success).toBe(false);
    expect(accountListQuery.safeParse({ cursor: ID }).success).toBe(true);
    expect(accountListQuery.safeParse({}).success).toBe(true);
  });
});
