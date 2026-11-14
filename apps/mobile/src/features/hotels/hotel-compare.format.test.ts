import type { ClientRateItemView, HotelRatesView } from "@ampm/core";

import {
  compareAttrs,
  compareCellText,
  rateForType,
  rateValueText,
  shortFreshnessChip,
} from "./hotel-compare.format";
import { hotelFixture, summaryFixture } from "./hotels.test-utils";

function rate(overrides: Partial<ClientRateItemView>): ClientRateItemView {
  return {
    itemType: "room_rate",
    amount: { minor: 1800000, currency: "INR" },
    amountMax: null,
    unit: "per_night",
    inclusions: null,
    ...overrides,
  };
}

const AS_OF = "2026-11-02T06:30:00.000Z";

describe("rateForType", () => {
  it("spans every item of the type in the first one's unit (several room categories)", () => {
    const rates: HotelRatesView = {
      status: "verified",
      asOf: AS_OF,
      items: [
        rate({ amount: { minor: 1800000, currency: "INR" } }),
        rate({
          amount: { minor: 1500000, currency: "INR" },
          amountMax: { minor: 3200000, currency: "INR" },
        }),
        rate({ amount: { minor: 100, currency: "INR" }, unit: "per_event" }),
      ],
    };
    const range = rateForType(rates, "room_rate");
    expect(range?.amount.minor).toBe(1500000);
    expect(range?.amountMax?.minor).toBe(3200000);
    expect(range && rateValueText(range)).toBe("₹15,000–₹32,000 per night");
  });

  it("shows no amount when the rates are on request, and none for a type not priced", () => {
    const items = [rate({})];
    expect(rateForType({ status: "on_request", asOf: null, items }, "room_rate")).toBeNull();
    expect(rateForType({ status: "verified", asOf: AS_OF, items }, "tax")).toBeNull();
  });

  it("writes a percentage charge as a share of the total", () => {
    const tax = rate({
      itemType: "tax",
      amount: { minor: 1800, currency: "INR" },
      unit: "percent",
    });
    expect(rateValueText(tax)).toBe("18% on the total");
  });
});

describe("shortFreshnessChip", () => {
  it("reads D7's short verified chip, and the detail's words otherwise", () => {
    expect(shortFreshnessChip("verified", AS_OF)).toEqual({
      label: "Verified 2 Nov 2026",
      tone: "success",
      dot: true,
    });
    expect(shortFreshnessChip("stale", AS_OF).label).toBe("Stale · checked 2 Nov 2026");
    expect(shortFreshnessChip("on_request", null).label).toBe("Rates on request");
  });
});

describe("compareAttrs", () => {
  const onRequest = { status: "on_request" as const, asOf: null, items: [] };

  it("leaves out the rooms row when no hotel has a room count", () => {
    const item = { ...hotelFixture({ totalRooms: null }), rates: onRequest };
    expect(compareAttrs([item, item]).map((attr) => attr.key)).not.toContain("rooms");
  });

  it("keeps the rooms row when one hotel has a room count, the other showing a dash", () => {
    const counted = { ...hotelFixture({ totalRooms: 84 }), rates: onRequest };
    const unknown = { ...hotelFixture({ totalRooms: null }), rates: onRequest };
    const rooms = compareAttrs([counted, unknown]).find((attr) => attr.key === "rooms");
    expect(rooms && compareCellText(rooms, counted)).toBe("84 rooms");
    expect(rooms && compareCellText(rooms, unknown)).toBe("—");
  });

  it("leaves out the seats row when no hotel knows its capacity", () => {
    const item = {
      ...hotelFixture({ summary: summaryFixture({ capacity: null }) }),
      rates: { status: "on_request" as const, asOf: null, items: [] },
    };
    expect(compareAttrs([item, item]).map((attr) => attr.label)).toEqual([
      "Destination",
      "Rooms",
      "Rates",
    ]);
  });
});
