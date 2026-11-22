import { describe, expect, it } from "vitest";

import {
  accountClientView,
  accountContactCreateRequest,
  accountContactUpdateRequest,
  accountListQuery,
  accountUpdateRequest,
  leadConvertRequest,
} from "./accounts.js";

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

describe("accountUpdateRequest", () => {
  it("refuses an empty body", () => {
    expect(accountUpdateRequest.safeParse({}).success).toBe(false);
  });

  it("clears an optional text field with null or an emptied box, and leaves absent fields out", () => {
    const parsed = accountUpdateRequest.safeParse({ coupleNames: "  ", internalNotes: null });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.coupleNames).toBeNull();
    expect(parsed.data.internalNotes).toBeNull();
    // An absent field is not a change: it must not reach the patch as a key.
    expect("preferredLocations" in parsed.data).toBe(false);
    expect("name" in parsed.data).toBe(false);
  });

  it("keeps the account name required when given (an account always has a name)", () => {
    expect(accountUpdateRequest.safeParse({ name: "   " }).success).toBe(false);
    expect(accountUpdateRequest.safeParse({ name: null }).success).toBe(false);
  });

  it("takes the couple with each one's father, and clears an emptied name", () => {
    const parsed = accountUpdateRequest.safeParse({
      brideName: " Priya ",
      brideFatherName: "Rahul Sharma",
      groomName: "Arjun",
      groomFatherName: "",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual({
      brideName: "Priya",
      brideFatherName: "Rahul Sharma",
      groomName: "Arjun",
      groomFatherName: null,
    });
  });

  it("caps the bride's and groom's names so the couple's name fits the account name", () => {
    expect(accountUpdateRequest.safeParse({ brideName: "a".repeat(120) }).success).toBe(true);
    expect(accountUpdateRequest.safeParse({ brideName: "a".repeat(121) }).success).toBe(false);
    expect(accountUpdateRequest.safeParse({ groomName: "a".repeat(121) }).success).toBe(false);
  });
});

describe("accountContactCreateRequest", () => {
  it("defaults the decision-maker and invite flags off and normalises the phone", () => {
    const parsed = accountContactCreateRequest.safeParse({
      name: "Anil Sharma",
      relation: "father of the bride",
      phone: "09876500001",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.isDecisionMaker).toBe(false);
    expect(parsed.data.invite).toBe(false);
    expect(parsed.data.phone).toBe("+919876500001");
  });

  it("needs an email to send a portal invite to (AUTH-02)", () => {
    const body = { name: "Anil Sharma", relation: "father", invite: true };
    expect(accountContactCreateRequest.safeParse(body).success).toBe(false);
    expect(
      accountContactCreateRequest.safeParse({ ...body, email: "Anil@Example.com" }).success,
    ).toBe(true);
  });
});

describe("accountContactUpdateRequest", () => {
  it("refuses an empty body and lets a nullable field be cleared", () => {
    expect(accountContactUpdateRequest.safeParse({}).success).toBe(false);
    const parsed = accountContactUpdateRequest.safeParse({ phone: null });
    expect(parsed.success).toBe(true);
  });
});
