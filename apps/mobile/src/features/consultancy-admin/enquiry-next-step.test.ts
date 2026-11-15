import type { HotelEnquiryStaffView } from "@ampm/core";

import { initialTab, nextStep, PIPELINE_STEPS, pipelineIndex } from "./enquiry-next-step";

type Enquiry = Pick<HotelEnquiryStaffView, "status" | "outcome" | "latestProposal">;

const PROPOSAL_ID = "018f0000-0000-7000-8000-0000000008d1";

function enquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return { status: "submitted", outcome: null, latestProposal: null, ...overrides };
}

const version = (
  versionNumber: number,
  status: NonNullable<Enquiry["latestProposal"]>["status"],
): Enquiry["latestProposal"] => ({ id: PROPOSAL_ID, versionNumber, status });

describe("pipelineIndex", () => {
  it("places each status on its step, and a closed enquiry past them all", () => {
    expect(pipelineIndex("submitted")).toBe(0);
    expect(pipelineIndex("negotiating")).toBe(1);
    expect(pipelineIndex("proposal_received")).toBe(2);
    expect(pipelineIndex("client_decision")).toBe(3);
    expect(pipelineIndex("confirmed")).toBe(4);
    expect(pipelineIndex("closed")).toBe(PIPELINE_STEPS.length);
  });
});

describe("nextStep", () => {
  it("asks the team to pick up a new request on its overview", () => {
    expect(nextStep(enquiry())).toMatchObject({ title: "New request", tab: "overview" });
  });

  it("asks for the client's proposal once the hotel has quoted", () => {
    expect(nextStep(enquiry({ status: "proposal_received" }))).toMatchObject({
      title: "Draft the client's proposal",
      tab: "proposals",
    });
  });

  it("follows the newest proposal: a draft to share, changes to make, the client to wait on", () => {
    expect(nextStep(enquiry({ latestProposal: version(3, "draft") })).title).toBe(
      "Version 3 is a draft",
    );
    expect(
      nextStep(
        enquiry({ status: "client_decision", latestProposal: version(2, "revision_requested") }),
      ),
    ).toMatchObject({ title: "The client asked for changes", kind: "danger", tab: "proposals" });
    expect(
      nextStep(enquiry({ status: "client_decision", latestProposal: version(2, "shared") })).detail,
    ).toBe("Version 2 is with the client to accept, decline or ask for changes.");
    expect(
      nextStep(enquiry({ status: "client_decision", latestProposal: version(2, "accepted") })),
    ).toMatchObject({ title: "The client accepted version 2", tab: "booking" });
  });

  it("says a closed enquiry's outcome and sends nowhere", () => {
    expect(nextStep(enquiry({ status: "closed", outcome: "no_availability" }))).toMatchObject({
      title: "Closed · No availability",
      tab: null,
    });
  });

  it("puts a confirmed booking's work on its milestones", () => {
    expect(
      nextStep(enquiry({ status: "confirmed", latestProposal: version(1, "accepted") })),
    ).toMatchObject({ title: "Booking confirmed", tab: "booking" });
  });
});

describe("initialTab", () => {
  it("opens on the proposals only when there is one to work on", () => {
    expect(initialTab(enquiry({ status: "proposal_received" }))).toBe("overview");
    expect(initialTab(enquiry({ latestProposal: version(1, "draft") }))).toBe("proposals");
    expect(initialTab(enquiry({ status: "closed", latestProposal: version(1, "declined") }))).toBe(
      "overview",
    );
  });
});
