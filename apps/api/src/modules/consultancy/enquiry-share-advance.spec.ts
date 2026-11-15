import { describe, expect, it, vi } from "vitest";
import type { HotelEnquiryStatus } from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import type { EnquiryRow } from "./enquiries.repository.js";
import { EnquiryShareAdvance } from "./enquiry-share-advance.js";
import { EnquiryTransitionWriter } from "./enquiry-transition-writer.js";

function enquiry(status: HotelEnquiryStatus): EnquiryRow {
  return {
    id: "enq-1",
    accountId: "acc-1",
    projectId: null,
    hotelId: "hot-1",
    requestedByUserId: "usr-1",
    assignedUserId: null,
    serviceAgreementId: null,
    status,
    dateFrom: new Date("2027-02-14"),
    dateTo: new Date("2027-02-16"),
    datesFlexible: false,
    guestEstimate: 120,
    roomsRequired: null,
    functionsSummary: null,
    contactPreference: null,
    notesClient: null,
    notesInternal: null,
    submittedAt: new Date(),
    closedAt: null,
    outcome: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function build(failOn?: HotelEnquiryStatus) {
  const writer = {
    write: vi.fn(
      async (
        _current: EnquiryRow,
        _patch: { status: HotelEnquiryStatus },
        to: HotelEnquiryStatus,
        _summary: string | null,
        _actorId: string,
      ) => {
        if (to === failOn) throw new Error("write failed");
      },
    ),
    notifyClient: vi.fn(async () => undefined),
  };
  const logger = { warn: vi.fn() };
  const advance = new EnquiryShareAdvance(
    writer as unknown as EnquiryTransitionWriter,
    logger as unknown as AppLogger,
  );
  const steps = () => writer.write.mock.calls.map((call) => [call[0].status, call[2], call[3]]);
  return { advance, writer, logger, steps };
}

describe("EnquiryShareAdvance", () => {
  it("walks a new request through 'proposal received' to the client's decision, one notice", async () => {
    const { advance, writer, steps } = build();
    await advance.advance(enquiry("submitted"), "sa-1", 3);
    expect(steps()).toEqual([
      ["submitted", "proposal_received", "Proposal version 3 prepared"],
      ["proposal_received", "client_decision", "Proposal version 3 shared with the client"],
    ]);
    expect(writer.write.mock.calls.every((call) => call[4] === "sa-1")).toBe(true);
    expect(writer.notifyClient).toHaveBeenCalledTimes(1);
    expect(writer.notifyClient).toHaveBeenCalledWith("acc-1", "enq-1");
  });

  it.each<HotelEnquiryStatus>([
    "awaiting_hotel",
    "response_received",
    "negotiating",
    "visit_scheduled",
  ])("moves an enquiry still with the hotel (%s) the same way", async (status) => {
    const { advance, steps } = build();
    await advance.advance(enquiry(status), "ht-1", 1);
    expect(steps().map((step) => step[1])).toEqual(["proposal_received", "client_decision"]);
  });

  it("takes one step when the hotel's quote is already in", async () => {
    const { advance, steps } = build();
    await advance.advance(enquiry("proposal_received"), "ht-1", 2);
    expect(steps()).toEqual([
      ["proposal_received", "client_decision", "Proposal version 2 shared with the client"],
    ]);
  });

  it.each<HotelEnquiryStatus>(["client_decision", "confirmed", "closed", "draft"])(
    "leaves a %s enquiry as it is, telling nobody",
    async (status) => {
      const { advance, writer } = build();
      await advance.advance(enquiry(status), "ht-1", 4);
      expect(writer.write).not.toHaveBeenCalled();
      expect(writer.notifyClient).not.toHaveBeenCalled();
    },
  );

  it("never fails the share: a failed step is logged, and the client hears how far it got", async () => {
    const { advance, writer, logger } = build("client_decision");
    await expect(advance.advance(enquiry("submitted"), "ht-1", 1)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith("consultancy.proposal.enquiry_advance_failed", {
      enquiryId: "enq-1",
    });
    // It reached 'proposal received' (client-visible), so one notice still goes out.
    expect(writer.notifyClient).toHaveBeenCalledTimes(1);
  });

  it("sends no notice when the very first step fails", async () => {
    const { advance, writer } = build("proposal_received");
    await advance.advance(enquiry("submitted"), "ht-1", 1);
    expect(writer.notifyClient).not.toHaveBeenCalled();
  });
});
