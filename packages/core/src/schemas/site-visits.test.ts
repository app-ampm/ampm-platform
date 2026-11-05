import { describe, expect, it } from "vitest";

import {
  siteVisitClientView,
  siteVisitCreateRequest,
  siteVisitFeedbackRequest,
  siteVisitStaffView,
} from "./site-visits.js";

const validClientView = {
  id: "00000000-0000-7000-8000-000000000001",
  enquiryId: "00000000-0000-7000-8000-000000000002",
  hotelId: "00000000-0000-7000-8000-000000000003",
  scheduledAt: "2027-02-10T09:30:00.000Z",
  status: "confirmed",
  clientFeedback: "Loved the lawn for the sangeet.",
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

describe("siteVisitClientView — no internal field on a client route (AC-05.5)", () => {
  it("accepts a well-formed client view", () => {
    expect(siteVisitClientView.safeParse(validClientView).success).toBe(true);
  });

  it.each(["attendeesText", "outcomeInternal", "createdBy"])(
    "rejects the internal field %s (additionalProperties:false)",
    (key) => {
      expect(siteVisitClientView.safeParse({ ...validClientView, [key]: null }).success).toBe(
        false,
      );
    },
  );

  it("is a strict subset of the staff view (the same client fields parse under staff)", () => {
    const staff = {
      ...validClientView,
      attendeesText: "Bride, groom, HT lead",
      outcomeInternal: "Hotel open to a 10% block discount — do not share.",
      createdBy: "00000000-0000-7000-8000-000000000004",
    };
    expect(siteVisitStaffView.safeParse(staff).success).toBe(true);
  });
});

describe("siteVisitCreateRequest", () => {
  const base = {
    enquiryId: "00000000-0000-7000-8000-000000000002",
    scheduledAt: "2027-02-10T09:30:00.000Z",
    attendeesText: "Bride, groom",
  };

  it("accepts a well-formed request and defaults attendeesText to null", () => {
    const { attendeesText: _omit, ...rest } = base;
    const r = siteVisitCreateRequest.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.attendeesText).toBeNull();
  });

  it("rejects a hotelId in the body (the hotel is the enquiry's, resolved server-side)", () => {
    const r = siteVisitCreateRequest.safeParse({ ...base, hotelId: validClientView.hotelId });
    expect(r.success).toBe(false); // strict object rejects the extra key
  });

  it("rejects a non-datetime scheduledAt", () => {
    expect(siteVisitCreateRequest.safeParse({ ...base, scheduledAt: "2027-02-10" }).success).toBe(
      false,
    );
  });
});

describe("siteVisitFeedbackRequest — client sets or clears their own feedback", () => {
  it("accepts a string and null, rejects a missing field", () => {
    expect(siteVisitFeedbackRequest.safeParse({ clientFeedback: "Great" }).success).toBe(true);
    expect(siteVisitFeedbackRequest.safeParse({ clientFeedback: null }).success).toBe(true);
    expect(siteVisitFeedbackRequest.safeParse({}).success).toBe(false);
  });
});
