import { describe, expect, it } from "vitest";

import {
  HOTEL_INFO_REQUEST_LIVE_STATUSES,
  HOTEL_INFO_REQUEST_REFERENCE,
  hotelFormCodeDelivery,
  hotelInfoRequestActorKind,
  hotelInfoRequestConsentKind,
  hotelInfoRequestEventType,
  hotelInfoRequestKind,
  hotelInfoRequestReference,
  hotelInfoRequestStatus,
  hotelInfoRequestTarget,
  hotelInfoRequestWithdrawalSource,
  isLiveHotelInfoRequestStatus,
} from "./hotel-info-requests";

/* The words of hotel information requests (D-188 §1 and §2), kept in step with the database enums. */
describe("hotel information request vocabulary", () => {
  it("names the kinds, targets, statuses, event types (D-188, and D-189's hotel people) and actor kinds", () => {
    expect(hotelInfoRequestKind.options).toEqual(["onboarding", "refresh"]);
    expect(hotelInfoRequestTarget.options).toEqual(["existing", "new"]);
    expect(hotelInfoRequestStatus.options).toEqual([
      "open",
      "submitted",
      "in_review",
      "changes_requested",
      "merged",
      "rejected",
      "revoked",
    ]);
    expect(hotelInfoRequestActorKind.options).toEqual(["staff", "hotel_person", "system"]);
    expect(hotelInfoRequestEventType.options).toEqual([
      "created",
      "link_reissued",
      "link_emailed",
      "share_recorded",
      "updated",
      "expiry_extended",
      "revoked",
      "code_requested",
      "person_verified",
      "person_updated",
    ]);
  });

  it("counts open, submitted, in_review and changes_requested as live, and no other status", () => {
    expect(HOTEL_INFO_REQUEST_LIVE_STATUSES).toEqual([
      "open",
      "submitted",
      "in_review",
      "changes_requested",
    ]);
    const live = hotelInfoRequestStatus.options.filter(isLiveHotelInfoRequestStatus);
    expect(live).toEqual([...HOTEL_INFO_REQUEST_LIVE_STATUSES]);
  });
});

describe("hotelInfoRequestReference", () => {
  it("writes HIR, the creation year and the number with four digits at least", () => {
    expect(hotelInfoRequestReference(2026, 1)).toBe("HIR-2026-0001");
    expect(hotelInfoRequestReference(2027, 42)).toBe("HIR-2027-0042");
    expect(hotelInfoRequestReference(2027, 9999)).toBe("HIR-2027-9999");
    expect(hotelInfoRequestReference(2028, 12345)).toBe("HIR-2028-12345");
  });

  it("matches the pattern a reference is checked against, and nothing looser", () => {
    expect(HOTEL_INFO_REQUEST_REFERENCE.test(hotelInfoRequestReference(2026, 7))).toBe(true);
    for (const text of ["HIR-2026-001", "HIR-26-0001", "hir-2026-0001", "HIR-2026-0001 ", "X"]) {
      expect(HOTEL_INFO_REQUEST_REFERENCE.test(text), text).toBe(false);
    }
  });

  it("refuses a number below 1 or not whole, and a year that is not four digits", () => {
    expect(() => hotelInfoRequestReference(2026, 0)).toThrow();
    expect(() => hotelInfoRequestReference(2026, 1.5)).toThrow();
    expect(() => hotelInfoRequestReference(999, 1)).toThrow();
    expect(() => hotelInfoRequestReference(10000, 1)).toThrow();
  });
});

/* The identity step's words (D-189 §1 and §2), kept in step with the database enums. */
describe("hotel form identity vocabulary", () => {
  it("delivers a code by SMS or on screen, and nothing else", () => {
    expect(hotelFormCodeDelivery.options).toEqual(["sms", "screen"]);
  });

  it("records the privacy notice consent now, withdrawn by the contributor or by staff", () => {
    expect(hotelInfoRequestConsentKind.options).toEqual(["privacy_notice"]);
    expect(hotelInfoRequestWithdrawalSource.options).toEqual(["contributor", "staff"]);
  });
});
