import { hotelEnquiryStatus } from "@ampm/core";

import { enquiryFixture } from "./consultancy-admin.test-utils";
import {
  ASSIGNED_BADGE,
  UNASSIGNED_BADGE,
  enquiryQueueLine,
  queueEyebrow,
  staffEnquiryBadge,
  statusWords,
  visitStepState,
} from "./consultancy-admin.format";

describe("staffEnquiryBadge", () => {
  it("names every status in the team's words, never the client's", () => {
    for (const status of hotelEnquiryStatus.options) {
      expect(staffEnquiryBadge[status].label).not.toMatch(/\byour\b/i);
    }
    expect(staffEnquiryBadge.client_decision.label).toBe("Client decision");
  });

  it("tones waiting on the hotel or the client gold, and a confirmed enquiry peacock", () => {
    expect(staffEnquiryBadge.awaiting_hotel.tone).toBe("warning");
    expect(staffEnquiryBadge.client_decision.tone).toBe("warning");
    expect(staffEnquiryBadge.confirmed.tone).toBe("success");
    expect(staffEnquiryBadge.closed.tone).toBe("neutral");
  });
});

describe("the holder badges", () => {
  it("marks an enquiry nobody holds as the team's to pick up (gold solid), a held one in hand", () => {
    expect(UNASSIGNED_BADGE).toEqual({ label: "Unassigned", tone: "danger" });
    expect(ASSIGNED_BADGE).toEqual({ label: "Assigned", tone: "info" });
  });
});

describe("queueEyebrow", () => {
  it("counts the enquiries in the pipeline's active stretch", () => {
    const items = [
      enquiryFixture({ status: "submitted" }),
      enquiryFixture({ status: "client_decision" }),
      enquiryFixture({ status: "draft" }),
      enquiryFixture({ status: "confirmed" }),
      enquiryFixture({ status: "closed" }),
    ];
    expect(queueEyebrow({ items, nextCursor: null })).toBe("2 open");
  });

  it("reads as a lower bound while later pages exist", () => {
    expect(queueEyebrow({ items: [enquiryFixture()], nextCursor: "next" })).toBe("1+ open");
  });
});

describe("enquiryQueueLine", () => {
  it("gives the guests and when the client submitted", () => {
    expect(enquiryQueueLine(enquiryFixture())).toBe("300 guests · submitted 3 Nov 2026");
  });

  it("falls back to when a draft was created", () => {
    const draft = enquiryFixture({ guestEstimate: 1, submittedAt: null });
    expect(enquiryQueueLine(draft)).toBe("1 guest · created 3 Nov 2026");
  });
});

describe("visitStepState", () => {
  it("puts a live visit on the current step and a completed one behind", () => {
    expect(visitStepState.proposed).toBe("current");
    expect(visitStepState.confirmed).toBe("current");
    expect(visitStepState.completed).toBe("done");
    expect(visitStepState.cancelled).toBe("upcoming");
  });
});

describe("statusWords", () => {
  it("turns a status or outcome into sentence-case words", () => {
    expect(statusWords("no_availability")).toBe("No availability");
    expect(statusWords("done")).toBe("Done");
  });
});
