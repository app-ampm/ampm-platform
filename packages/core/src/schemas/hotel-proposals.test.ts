import { describe, expect, it } from "vitest";

import {
  hotelProposalClientView,
  hotelProposalCreateRequest,
  hotelProposalDecisionRequest,
  hotelProposalInternalView,
} from "./hotel-proposals.js";

const money = (minor: number) => ({ minor, currency: "INR" as const });

const validClientView = {
  id: "00000000-0000-7000-8000-000000000001",
  enquiryId: "00000000-0000-7000-8000-000000000002",
  hotelId: "00000000-0000-7000-8000-000000000003",
  versionNumber: 1,
  status: "shared",
  validUntil: "2027-01-31",
  clientTotal: money(5000000),
  currency: "INR",
  documentId: null,
  sharedAt: "2026-11-05T00:00:00.000Z",
  decidedAt: null,
  supersedesProposalId: null,
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
  lines: [],
};

describe("hotelProposalClientView — internal money never on a client route (AC-05.2)", () => {
  it("accepts a well-formed client view", () => {
    expect(hotelProposalClientView.safeParse(validClientView).success).toBe(true);
  });

  it.each(["internalTotal", "margin", "decidedByUserId", "approvalId", "createdBy"])(
    "rejects the internal field %s (additionalProperties:false)",
    (key) => {
      const bad = {
        ...validClientView,
        [key]: key.endsWith("Total") || key === "margin" ? money(1) : null,
      };
      expect(hotelProposalClientView.safeParse(bad).success).toBe(false);
    },
  );

  it("the client line view rejects clientVisible and proposalId (internal line fields)", () => {
    const withLine = {
      ...validClientView,
      lines: [
        {
          id: "00000000-0000-7000-8000-000000000009",
          itemType: "room_rate",
          description: "40 rooms",
          quantity: 40,
          unitAmount: money(100000),
          totalAmount: money(4000000),
          clientVisible: true, // not a client line field
        },
      ],
    };
    expect(hotelProposalClientView.safeParse(withLine).success).toBe(false);
  });
});

describe("hotelProposalInternalView — internalTotal + margin optional (absent without the grant)", () => {
  const base = {
    ...validClientView,
    decidedByUserId: null,
    approvalId: null,
    createdBy: null,
    lines: [],
  };

  it("parses without internalTotal/margin (a reader lacking read_internal_amount, e.g. SM)", () => {
    expect(hotelProposalInternalView.safeParse(base).success).toBe(true);
  });

  it("parses with internalTotal + margin (a holder of read_internal_amount); margin may be negative", () => {
    const withInternal = { ...base, internalTotal: money(4200000), margin: money(-200000) };
    expect(hotelProposalInternalView.safeParse(withInternal).success).toBe(true);
  });
});

describe("hotelProposalCreateRequest", () => {
  const base = {
    enquiryId: "00000000-0000-7000-8000-000000000002",
    validUntil: "2027-01-31",
    clientTotal: money(5000000),
    internalTotal: money(4200000),
    lines: [
      {
        itemType: "venue_rental",
        description: "Lawn",
        quantity: 1,
        unitAmount: money(1000000),
        totalAmount: money(1000000),
        clientVisible: true,
      },
    ],
  };

  it("accepts a well-formed request and defaults lines to []", () => {
    const { lines: _l, ...noLines } = base;
    const r = hotelProposalCreateRequest.safeParse(noLines);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.lines).toEqual([]);
  });

  it("rejects an out-of-range total (would overflow numeric(14,2))", () => {
    const r = hotelProposalCreateRequest.safeParse({
      ...base,
      clientTotal: money(100_000_000_000_000),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a hotelId in the body (resolved server-side)", () => {
    expect(
      hotelProposalCreateRequest.safeParse({ ...base, hotelId: validClientView.hotelId }).success,
    ).toBe(false);
  });

  it("rejects a line quantity that would overflow numeric(14,2)", () => {
    const line = { ...base.lines[0], quantity: 1_000_000_000_000_000 };
    expect(hotelProposalCreateRequest.safeParse({ ...base, lines: [line] }).success).toBe(false);
  });
});

describe("hotelProposalDecisionRequest", () => {
  it.each(["accepted", "declined", "revision_requested"])("accepts %s", (decision) => {
    expect(hotelProposalDecisionRequest.safeParse({ decision }).success).toBe(true);
  });

  it("rejects an unknown decision", () => {
    expect(hotelProposalDecisionRequest.safeParse({ decision: "maybe" }).success).toBe(false);
  });
});
