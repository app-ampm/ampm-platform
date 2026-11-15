import { describe, expect, it } from "vitest";

import {
  hotelEnquiryClientView,
  hotelEnquiryCreateRequest,
  hotelEnquiryEventClientView,
  hotelEnquiryWithdrawableStatuses,
  isHotelEnquiryWithdrawable,
  HOTEL_ENQUIRY_STAGE_STATUSES,
  hotelEnquiryPipelineView,
  hotelEnquiryStage,
  hotelEnquiryStageOf,
  hotelEnquiryStatus,
} from "./consultancy.js";

const validClientView = {
  id: "00000000-0000-7000-8000-000000000001",
  hotelId: "00000000-0000-7000-8000-000000000002",
  projectId: null,
  status: "submitted",
  dateFrom: "2027-02-14",
  dateTo: "2027-02-16",
  datesFlexible: false,
  guestEstimate: 120,
  roomsRequired: 40,
  functionsSummary: null,
  contactPreference: null,
  notesClient: null,
  outcome: null,
  submittedAt: "2026-11-04T00:00:00.000Z",
  closedAt: null,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
};

describe("hotelEnquiryClientView — no internal field on a client route (AC-05.2)", () => {
  it("accepts a well-formed client view", () => {
    expect(hotelEnquiryClientView.safeParse(validClientView).success).toBe(true);
  });

  it.each([
    "accountId",
    "requestedByUserId",
    "assignedUserId",
    "serviceAgreementId",
    "notesInternal",
  ])("rejects the internal field %s (additionalProperties:false)", (key) => {
    expect(hotelEnquiryClientView.safeParse({ ...validClientView, [key]: "x" }).success).toBe(
      false,
    );
  });
});

describe("hotelEnquiryEventClientView — no internal event field (AC-05.1)", () => {
  const validEvent = {
    id: "00000000-0000-7000-8000-000000000003",
    eventType: "submitted",
    occurredAt: "2026-11-04T00:00:00.000Z",
    summary: null,
  };

  it("accepts a client event view", () => {
    expect(hotelEnquiryEventClientView.safeParse(validEvent).success).toBe(true);
  });

  it.each(["userId", "internalOnly", "documentId", "enquiryId"])(
    "rejects the internal event field %s",
    (key) => {
      expect(hotelEnquiryEventClientView.safeParse({ ...validEvent, [key]: "x" }).success).toBe(
        false,
      );
    },
  );
});

describe("hotelEnquiryCreateRequest", () => {
  const base = {
    hotelId: "00000000-0000-7000-8000-000000000002",
    dateFrom: "2027-02-14",
    dateTo: "2027-02-16",
    guestEstimate: 100,
  };

  it("defaults the optional fields", () => {
    const parsed = hotelEnquiryCreateRequest.parse(base);
    expect(parsed.datesFlexible).toBe(false);
    expect(parsed.roomsRequired).toBeNull();
  });

  it("refuses dateTo before dateFrom", () => {
    expect(
      hotelEnquiryCreateRequest.safeParse({ ...base, dateFrom: "2027-02-16", dateTo: "2027-02-14" })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown field (strict)", () => {
    expect(hotelEnquiryCreateRequest.safeParse({ ...base, notesInternal: "x" }).success).toBe(
      false,
    );
  });
});

describe("isHotelEnquiryWithdrawable (CP-09)", () => {
  it("is true for every active pipeline status (7 of them)", () => {
    for (const status of hotelEnquiryWithdrawableStatuses) {
      expect(isHotelEnquiryWithdrawable(status)).toBe(true);
    }
    expect(hotelEnquiryWithdrawableStatuses).toHaveLength(7);
  });

  it("is false for a draft, a confirmed booking and a closed enquiry", () => {
    expect(isHotelEnquiryWithdrawable("draft")).toBe(false);
    expect(isHotelEnquiryWithdrawable("confirmed")).toBe(false);
    expect(isHotelEnquiryWithdrawable("closed")).toBe(false);
  });
});

describe("the staff pipeline's stages", () => {
  it("puts every status in exactly one stage", () => {
    const placed = hotelEnquiryStage.options.flatMap(
      (stage) => HOTEL_ENQUIRY_STAGE_STATUSES[stage],
    );
    expect([...placed].sort()).toEqual([...hotelEnquiryStatus.options].sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it("reads a status's stage", () => {
    expect(hotelEnquiryStageOf("submitted")).toBe("new");
    expect(hotelEnquiryStageOf("negotiating")).toBe("with_hotel");
    expect(hotelEnquiryStageOf("proposal_received")).toBe("proposal");
    expect(hotelEnquiryStageOf("closed")).toBe("closed");
  });

  it("needs a count for every stage in the pipeline view", () => {
    const stages = { new: 1, with_hotel: 0, proposal: 0, client_decision: 2, confirmed: 0 };
    expect(hotelEnquiryPipelineView.safeParse({ stages, unassignedOpen: 1 }).success).toBe(false);
    expect(
      hotelEnquiryPipelineView.safeParse({ stages: { ...stages, closed: 4 }, unassignedOpen: 1 })
        .success,
    ).toBe(true);
  });
});
