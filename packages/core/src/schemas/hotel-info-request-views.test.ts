import { describe, expect, it } from "vitest";

import {
  HOTEL_DUPLICATE_HINTS_MAX,
  HOTEL_INFO_REQUEST_EVENTS_SHOWN,
  hotelDuplicateHints,
  hotelFormModeView,
  hotelInfoRequestDetail,
  hotelInfoRequestFullView,
  hotelInfoRequestLinkIssued,
  hotelInfoRequestPage,
  hotelInfoRequestSummaryView,
} from "./hotel-info-request-views";

/*
 * What the staff routes answer for hotel information requests (D-188 §3): a summary for a reader without
 * `hotels.info_requests.update` (SM, PM) and the full view, with the recipient and the latest events, for
 * its holders (SA, HT); the link only in the create and reissue answers.
 */

const AT = "2026-11-24T10:00:00.000Z";

const summary = {
  id: "0192f1a0-0000-7000-8000-0000000000b1",
  reference: "HIR-2026-0001",
  kind: "onboarding",
  target: "existing",
  status: "open",
  isTest: false,
  hotelId: "0192f1a0-0000-7000-8000-0000000000a1",
  hotelName: "Synthetic Lake Hotel",
  proposedName: null,
  proposedDestinationId: null,
  proposedWebAddress: null,
  destinationName: "Synthetic Destination",
  officialWebsite: null,
  switchboardPhone: null,
  switchboardSource: null,
  displayLabel: null,
  staffNote: null,
  expiresAt: "2026-12-24T10:00:00.000Z",
  isExpired: false,
  statusOnlyUntil: null,
  tokenGeneration: 1,
  linkIssuedAt: AT,
  linkEmailedAt: null,
  revokedAt: null,
  revokeReason: null,
  createdAt: AT,
  updatedAt: AT,
} as const;

const event = {
  id: "0192f1a0-0000-7000-8000-0000000000c1",
  eventType: "created",
  actorKind: "staff",
  actorUserId: "0192f1a0-0000-7000-8000-0000000000d1",
  detail: { generation: 1, expiresAt: "2026-12-24T10:00:00.000Z" },
  occurredAt: AT,
} as const;

const full = {
  ...summary,
  recipientName: "Synthetic Sales Desk",
  recipientEmail: "sales@synthetic-hotel.example",
  extendableUntil: "2027-02-22T10:00:00.000Z",
  events: [event],
};

describe("the request's audiences", () => {
  it("gives a summary reader neither the recipient nor the events, not even as null", () => {
    expect(hotelInfoRequestSummaryView.safeParse(summary).success).toBe(true);
    for (const field of ["recipientName", "recipientEmail", "events", "extendableUntil"]) {
      expect(
        hotelInfoRequestSummaryView.safeParse({ ...summary, [field]: null }).success,
        field,
      ).toBe(false);
    }
  });

  it("gives an update holder the recipient, the extension limit and the latest events", () => {
    expect(hotelInfoRequestFullView.safeParse(full).success).toBe(true);
    expect(hotelInfoRequestFullView.safeParse(summary).success).toBe(false);
    const tooMany = Array.from({ length: HOTEL_INFO_REQUEST_EVENTS_SHOWN + 1 }, () => event);
    expect(hotelInfoRequestFullView.safeParse({ ...full, events: tooMany }).success).toBe(false);
  });

  it("answers one request in either model, and lists summaries", () => {
    expect(hotelInfoRequestDetail.safeParse(full).success).toBe(true);
    expect(hotelInfoRequestDetail.safeParse(summary).success).toBe(true);
    expect(hotelInfoRequestPage.safeParse({ items: [summary], nextCursor: null }).success).toBe(
      true,
    );
    expect(hotelInfoRequestPage.safeParse({ items: [full], nextCursor: null }).success).toBe(false);
  });

  it("keeps an event's detail to flat values, never a nested object", () => {
    const nested = { ...event, detail: { link: { url: "x" } } };
    expect(hotelInfoRequestFullView.safeParse({ ...full, events: [nested] }).success).toBe(false);
    const names = { ...event, eventType: "updated", detail: { fields: ["displayLabel"] } };
    expect(hotelInfoRequestFullView.safeParse({ ...full, events: [names] }).success).toBe(true);
  });
});

describe("the create and reissue answer", () => {
  const issued = {
    request: full,
    link: {
      url: "https://site.synthetic.example/hotel-form#k=hfl_synthetic-link-secret",
      expiresAt: "2026-12-24T10:00:00.000Z",
    },
    email: "queued",
  };

  it("carries the request, the link once, and what became of the email", () => {
    expect(hotelInfoRequestLinkIssued.safeParse(issued).success).toBe(true);
    for (const email of ["not_requested", "mode_off", "mode_test_only", "failed"]) {
      expect(hotelInfoRequestLinkIssued.safeParse({ ...issued, email }).success, email).toBe(true);
    }
    expect(hotelInfoRequestLinkIssued.safeParse({ ...issued, email: "sent" }).success).toBe(false);
    expect(hotelInfoRequestLinkIssued.safeParse({ ...issued, secret: "x" }).success).toBe(false);
  });
});

describe("the duplicate hints", () => {
  const hint = {
    hotelId: "0192f1a0-0000-7000-8000-0000000000a1",
    name: "Synthetic Lake Hotel",
    status: "active",
    destinationName: "Synthetic Destination",
    website: "https://synthetic-lake-hotel.example",
    deletedAt: null,
    reasons: ["name", "web_address"],
    sharedHost: false,
  } as const;

  it("names each hotel, why it is a hint and whether it was deleted, twenty at most", () => {
    expect(hotelDuplicateHints.safeParse({ hints: [hint] }).success).toBe(true);
    expect(hotelDuplicateHints.safeParse({ hints: [{ ...hint, deletedAt: AT }] }).success).toBe(
      true,
    );
    expect(hotelDuplicateHints.safeParse({ hints: [{ ...hint, reasons: [] }] }).success).toBe(
      false,
    );
    const many = Array.from({ length: HOTEL_DUPLICATE_HINTS_MAX + 1 }, () => hint);
    expect(hotelDuplicateHints.safeParse({ hints: many }).success).toBe(false);
  });

  it("names the live new-hotel requests of the same name in the destination asked for (D-192)", () => {
    const live = {
      requestId: "0192f1a0-0000-7000-8000-0000000000b2",
      reference: "HIR-2026-0002",
      status: "open",
      isTest: false,
      proposedName: "Synthetic Lake Hotel",
      destinationName: "Synthetic Destination",
      proposedWebAddress: null,
    } as const;
    expect(hotelDuplicateHints.safeParse({ hints: [], liveRequests: [live] }).success).toBe(true);
    const withSite = { ...live, proposedWebAddress: "https://synthetic-lake-hotel.example" };
    expect(hotelDuplicateHints.safeParse({ hints: [], liveRequests: [withSite] }).success).toBe(
      true,
    );
    expect(
      hotelDuplicateHints.safeParse({ hints: [], liveRequests: [{ ...live, tokenHash: "x" }] })
        .success,
    ).toBe(false);
    const many = Array.from({ length: HOTEL_DUPLICATE_HINTS_MAX + 1 }, () => live);
    expect(hotelDuplicateHints.safeParse({ hints: [], liveRequests: many }).success).toBe(false);
  });
});

describe("the hotel form's mode, for the Hotel team", () => {
  it("answers the mode alone, and nothing else of the policy", () => {
    for (const mode of ["off", "test_only", "on"]) {
      expect(hotelFormModeView.safeParse({ mode }).success, mode).toBe(true);
    }
    expect(hotelFormModeView.safeParse({ mode: "paused" }).success).toBe(false);
    expect(hotelFormModeView.safeParse({ mode: "on", replyTo: null }).success).toBe(false);
    expect(hotelFormModeView.safeParse({}).success).toBe(false);
  });
});
