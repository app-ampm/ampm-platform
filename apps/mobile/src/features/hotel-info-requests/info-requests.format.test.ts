import {
  currentRequestOf,
  duplicateHintReasons,
  emailOutcomeText,
  eventLine,
  expiryText,
  formModeNotice,
  infoRequestHotelName,
  infoRequestStatusLabel,
  infoRequestStatusTone,
  proposedHotelText,
  requestRowSummary,
} from "./info-requests.format";
import {
  duplicateHintFixture,
  newHotelRequestFixture,
  requestEventFixture,
  requestFullFixture,
  requestSummaryFixture,
} from "./info-requests.test-utils";

describe("a request's status", () => {
  it("reads every status in words, and gives the Hotel team's turn the needs-you chip", () => {
    expect(infoRequestStatusLabel("in_review")).toBe("In review");
    expect(infoRequestStatusLabel("changes_requested")).toBe("Changes requested");
    expect(infoRequestStatusTone("submitted")).toBe("danger");
    expect(infoRequestStatusTone("open")).toBe("warning");
    expect(infoRequestStatusTone("merged")).toBe("success");
    expect(infoRequestStatusTone("revoked")).toBe("neutral");
  });

  it("names the catalogue hotel, or a new hotel's proposed name", () => {
    expect(infoRequestHotelName(requestSummaryFixture())).toBe("The Lakeside Palace");
    expect(infoRequestHotelName(newHotelRequestFixture())).toBe("The Desert Fort");
  });

  it("states a new hotel's proposed identity, and nothing for a catalogue hotel", () => {
    expect(proposedHotelText(newHotelRequestFixture())).toBe(
      "The Desert Fort · Jaisalmer · https://desert-fort.example",
    );
    expect(proposedHotelText(requestSummaryFixture())).toBeNull();
  });

  it("summarises a row for a screen reader, test and expiry included", () => {
    const row = requestSummaryFixture({ isTest: true, isExpired: true });
    expect(requestRowSummary(row)).toBe(
      "HIR-2026-0001, The Lakeside Palace, Udaipur, open, link expired, test request",
    );
  });
});

describe("expiryText", () => {
  it("says until when a live link works, or since when it has not", () => {
    expect(expiryText(requestSummaryFixture())).toBe("Link valid until 24 Dec 2026");
    expect(expiryText(requestSummaryFixture({ isExpired: true }))).toBe(
      "Link expired on 24 Dec 2026",
    );
  });

  it("says a revoked link was revoked, and a finished one no longer opens", () => {
    const revoked = requestSummaryFixture({
      status: "revoked",
      revokedAt: "2026-11-25T09:00:00.000Z",
    });
    expect(expiryText(revoked)).toBe("Link revoked on 25 Nov 2026");
    expect(expiryText(requestSummaryFixture({ status: "rejected" }))).toBe(
      "The link no longer opens the form",
    );
  });
});

describe("currentRequestOf", () => {
  it("is the live request, else the latest", () => {
    const merged = requestSummaryFixture({ id: "a", status: "merged" });
    const open = requestSummaryFixture({ id: "b", status: "open" });
    expect(currentRequestOf([merged, open])?.id).toBe("b");
    expect(currentRequestOf([merged])?.id).toBe("a");
    expect(currentRequestOf([])).toBeNull();
  });
});

describe("formModeNotice", () => {
  it("says the form is off and nothing reaches a hotel", () => {
    expect(formModeNotice("off", false)).toMatchObject({
      title: "The hotel form is off",
      kind: "warning",
    });
  });

  it("says test mode emails a test request but not another", () => {
    expect(formModeNotice("test_only", true).description).toMatch(/test request's link opens/);
    expect(formModeNotice("test_only", false).description).toMatch(/not emailed/);
  });

  it("says the form is on and Email it sends the link", () => {
    expect(formModeNotice("on", false)).toMatchObject({ kind: "success" });
    expect(formModeNotice("on", false).description).toMatch(/Email it sends/);
  });
});

describe("emailOutcomeText", () => {
  it("names where a queued link goes, and why another was not emailed", () => {
    expect(emailOutcomeText("queued", requestFullFixture())).toBe(
      "Emailed to sales@lakeside.example.",
    );
    expect(emailOutcomeText("queued", requestSummaryFixture())).toBe("Emailed to the recipient.");
    expect(emailOutcomeText("mode_off", requestFullFixture())).toMatch(/form is off/);
    expect(emailOutcomeText("mode_test_only", requestFullFixture())).toMatch(/test mode/);
    expect(emailOutcomeText("failed", requestFullFixture())).toMatch(/could not be queued/);
    expect(emailOutcomeText("not_requested", requestFullFixture())).toBe("Not emailed.");
  });
});

describe("eventLine", () => {
  it("says what happened, when, and who did it", () => {
    expect(eventLine(requestEventFixture())).toMatch(
      /^Request created · 24 NOV 2026 · \d\d:\d\d · Staff$/,
    );
  });

  it("reads each event's detail: the fields edited, the new expiry, the channel, the cause", () => {
    const at = { occurredAt: "2026-11-25T09:00:00.000Z" };
    expect(
      eventLine(
        requestEventFixture({
          ...at,
          eventType: "updated",
          detail: { fields: ["displayLabel", "recipientEmail"] },
        }),
      ),
    ).toMatch(/^Edited the label and recipient email · /);
    expect(
      eventLine(
        requestEventFixture({
          ...at,
          eventType: "expiry_extended",
          detail: { from: "x", to: "2027-01-23T10:00:00.000Z" },
        }),
      ),
    ).toMatch(/^Extended to 23 Jan 2027 · /);
    expect(
      eventLine(
        requestEventFixture({
          ...at,
          eventType: "share_recorded",
          detail: { channel: "whatsapp" },
        }),
      ),
    ).toMatch(/^Shared on WhatsApp · /);
    expect(
      eventLine(
        requestEventFixture({ ...at, eventType: "link_reissued", detail: { generation: 2 } }),
      ),
    ).toMatch(/^New link issued \(link 2\) · /);
    expect(
      eventLine(
        requestEventFixture({
          ...at,
          eventType: "revoked",
          actorKind: "system",
          actorUserId: null,
          detail: { fromStatus: "open", cause: "hotel_deleted" },
        }),
      ),
    ).toMatch(/^Revoked: the hotel was deleted · .* · System$/);
  });
});

describe("duplicateHintReasons", () => {
  it("says why a hotel is a hint, a shared host as weak, and a deleted hotel as deleted", () => {
    expect(duplicateHintReasons(duplicateHintFixture({ reasons: ["name", "web_address"] }))).toBe(
      "Same name · Same web address",
    );
    expect(
      duplicateHintReasons(duplicateHintFixture({ reasons: ["website_host"], sharedHost: true })),
    ).toBe("Same website host, shared by several hotels");
    expect(
      duplicateHintReasons(
        duplicateHintFixture({ reasons: ["name_variant"], deletedAt: "2026-11-01T10:00:00.000Z" }),
      ),
    ).toBe("Same as one of its other names · Deleted 1 Nov 2026");
  });
});
