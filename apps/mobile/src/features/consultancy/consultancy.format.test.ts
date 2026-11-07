import {
  ENQUIRY_STEPS,
  enquiryBadge,
  enquiryChip,
  enquiryFacts,
  enquiryStep,
  formatDate,
  formatStay,
  milestoneStepStates,
  proposalDates,
} from "./consultancy.format";

describe("enquiry status chips", () => {
  it("maps the statuses onto Peacock Night's treatments", () => {
    expect(enquiryBadge.submitted).toEqual({ label: "Submitted", tone: "info" });
    expect(enquiryBadge.awaiting_hotel).toEqual({ label: "Awaiting hotel", tone: "warning" });
    expect(enquiryBadge.negotiating.tone).toBe("warning");
    expect(enquiryBadge.response_received.tone).toBe("success");
    expect(enquiryBadge.proposal_received.tone).toBe("success");
    expect(enquiryBadge.client_decision).toEqual({ label: "Your decision", tone: "danger" });
    expect(enquiryBadge.confirmed.tone).toBe("success");
    expect(enquiryBadge.closed.tone).toBe("neutral");
  });

  it("says how a closed enquiry closed", () => {
    expect(enquiryChip({ status: "closed", outcome: "no_availability" })).toEqual({
      label: "Not available",
      tone: "neutral",
    });
    expect(enquiryChip({ status: "closed", outcome: "booked" })).toEqual({
      label: "Booked",
      tone: "success",
    });
    expect(enquiryChip({ status: "closed", outcome: null })).toEqual(enquiryBadge.closed);
    expect(enquiryChip({ status: "awaiting_hotel", outcome: null })).toEqual(
      enquiryBadge.awaiting_hotel,
    );
  });
});

describe("enquiryStep", () => {
  it("places each status on the five client steps, in the machine's order", () => {
    const at = (status: Parameters<typeof enquiryStep>[0]["status"]) =>
      enquiryStep({ status, outcome: null });
    expect(at("draft")).toBe(-1);
    expect(at("submitted")).toBe(0);
    expect(at("awaiting_hotel")).toBe(1);
    expect(at("response_received")).toBe(2);
    expect(at("negotiating")).toBe(2);
    expect(at("visit_scheduled")).toBe(2);
    expect(at("proposal_received")).toBe(3);
    expect(at("client_decision")).toBe(4);
    expect(at("confirmed")).toBe(ENQUIRY_STEPS.length);
  });

  it("shows every step done for a booking and no stepper for any other closing", () => {
    expect(enquiryStep({ status: "closed", outcome: "booked" })).toBe(ENQUIRY_STEPS.length);
    expect(enquiryStep({ status: "closed", outcome: "no_availability" })).toBeNull();
    expect(enquiryStep({ status: "closed", outcome: "withdrawn" })).toBeNull();
    expect(enquiryStep({ status: "closed", outcome: null })).toBeNull();
  });
});

describe("milestoneStepStates", () => {
  it("marks done ones done, the first open one and every overdue one current", () => {
    expect(milestoneStepStates(["done", "pending", "pending"])).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
    expect(milestoneStepStates(["done", "pending", "overdue"])).toEqual([
      "done",
      "current",
      "current",
    ]);
    expect(milestoneStepStates(["cancelled", "done"])).toEqual(["upcoming", "done"]);
  });
});

describe("dates", () => {
  it("writes a stay compactly, as the mocks do", () => {
    expect(formatStay("2027-02-12", "2027-02-14")).toBe("12–14 Feb 2027");
    expect(formatStay("2027-02-28", "2027-03-02")).toBe("28 Feb – 2 Mar 2027");
    expect(formatStay("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 – 2 Jan 2027");
    expect(formatStay("2027-02-12", "2027-02-12")).toBe("12 Feb 2027");
  });

  it("reads a date as the calendar day it names, and keeps a value it cannot parse", () => {
    expect(formatDate("2027-02-12")).toBe("12 Feb 2027");
    expect(formatDate("soon")).toBe("soon");
  });

  it("puts an enquiry's stay on one data line", () => {
    const stay = { dateFrom: "2027-02-12", dateTo: "2027-02-14", guestEstimate: 300 };
    expect(enquiryFacts({ ...stay, roomsRequired: 80, datesFlexible: true })).toBe(
      "12–14 Feb 2027 · 300 guests · 80 rooms · Flexible dates",
    );
    expect(
      enquiryFacts({ ...stay, guestEstimate: 1, roomsRequired: null, datesFlexible: false }),
    ).toBe("12–14 Feb 2027 · 1 guest");
  });

  it("dates a proposal by when it was shared and how long it holds", () => {
    expect(proposalDates({ sharedAt: null, validUntil: "2026-11-20" })).toBe(
      "Valid until 20 Nov 2026",
    );
    expect(proposalDates({ sharedAt: null, validUntil: null })).toBeNull();
  });
});
