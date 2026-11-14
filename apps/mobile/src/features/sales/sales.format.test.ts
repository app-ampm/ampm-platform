import { leadStatus } from "@ampm/core";

import {
  PIPELINE_STATUSES,
  activityLabel,
  formatAge,
  formatMoment,
  formatStay,
  isOpenLead,
  leadFacts,
  leadPlan,
  leadSummary,
  statusLabel,
  statusTone,
} from "./sales.format";
import { leadFixture } from "./sales.test-utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("the pipeline", () => {
  it("runs in the status machine's order, New to Closed", () => {
    expect(PIPELINE_STATUSES).toEqual(leadStatus.options);
    expect(PIPELINE_STATUSES[0]).toBe("new");
    expect(PIPELINE_STATUSES.at(-1)).toBe("closed");
  });

  it("names every stage with a word and gives it a chip treatment", () => {
    for (const status of PIPELINE_STATUSES) {
      expect(statusLabel(status)).toMatch(/^[A-Z]/);
      expect(statusTone(status)).toBeTruthy();
    }
    expect(statusLabel("follow_up")).toBe("Follow-up");
    expect(statusTone("converted")).toBe("success");
    expect(statusTone("new")).toBe("danger");
  });

  it("counts a lead as open until it is converted or closed", () => {
    expect(isOpenLead("new")).toBe(true);
    expect(isOpenLead("follow_up")).toBe(true);
    expect(isOpenLead("converted")).toBe(false);
    expect(isOpenLead("closed")).toBe(false);
  });
});

describe("formatStay", () => {
  it("writes a range the way the mocks do", () => {
    expect(formatStay("2027-02-12", "2027-02-14")).toBe("12–14 FEB 2027");
    expect(formatStay("2027-02-28", "2027-03-02")).toBe("28 FEB – 2 MAR 2027");
    expect(formatStay("2027-12-30", "2028-01-02")).toBe("30 DEC 2027 – 2 JAN 2028");
  });

  it("writes one day when only one is known or both are the same", () => {
    expect(formatStay("2027-02-12", null)).toBe("12 FEB 2027");
    expect(formatStay(null, "2027-02-14")).toBe("14 FEB 2027");
    expect(formatStay("2027-02-12", "2027-02-12")).toBe("12 FEB 2027");
  });

  it("gives nothing without dates", () => {
    expect(formatStay(null, null)).toBeNull();
  });
});

describe("formatAge", () => {
  const now = Date.UTC(2026, 10, 7, 12, 0);
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("counts minutes, hours, days and weeks", () => {
    expect(formatAge(ago(0), now)).toBe("1m");
    expect(formatAge(ago(30 * 60_000), now)).toBe("30m");
    expect(formatAge(ago(2 * HOUR), now)).toBe("2h");
    expect(formatAge(ago(3 * DAY), now)).toBe("3d");
    expect(formatAge(ago(15 * DAY), now)).toBe("2w");
  });

  it("gives the date once a lead is more than eight weeks old", () => {
    expect(formatAge(ago(70 * DAY), now)).toMatch(/^\d{1,2} (AUG|SEP) 2026$/);
  });
});

describe("formatMoment", () => {
  it("writes the device's day and time", () => {
    expect(formatMoment(new Date(2026, 10, 5, 18, 2).toISOString())).toBe("5 NOV 2026 · 18:02");
  });
});

describe("lead lines", () => {
  it("joins where and when, leaving out what the lead did not give", () => {
    expect(leadPlan(leadFixture())).toBe("Udaipur or Goa · 12–14 DEC 2027 · 250 guests");
    expect(
      leadPlan(
        leadFixture({ destinationText: null, tentativeDateFrom: null, tentativeDateTo: null }),
      ),
    ).toBe("250 guests");
    expect(
      leadPlan(
        leadFixture({
          destinationText: null,
          tentativeDateFrom: null,
          tentativeDateTo: null,
          guestEstimate: null,
        }),
      ),
    ).toBeNull();
  });

  it("lines up a lead's facts for its record header, owner and source always", () => {
    expect(leadFacts(leadFixture())).toBe(
      "Udaipur or Goa · 12–14 DEC 2027 · About 250 guests · Source: Instagram · Owner: Unassigned",
    );
    expect(
      leadFacts(
        leadFixture({
          destinationText: null,
          tentativeDateFrom: null,
          tentativeDateTo: null,
          guestEstimate: null,
          ownerName: "Sana Verma",
        }),
      ),
    ).toBe("Source: Instagram · Owner: Sana Verma");
  });

  it("sums a lead up as its stage and flags", () => {
    expect(leadSummary(leadFixture())).toBe("New, demo requested");
    expect(
      leadSummary(
        leadFixture({
          status: "demo_offered",
          requestedDemo: false,
          duplicateOfLeadId: "018f0000-0000-7000-8000-0000000001ff",
        }),
      ),
    ).toBe("Demo offered, possible duplicate");
  });

  it("names every activity type", () => {
    expect(activityLabel("call_request")).toBe("Call request");
    expect(activityLabel("whatsapp")).toBe("WhatsApp");
  });
});
