import { describe, expect, it } from "vitest";

import type { ClientRateItemView } from "./schemas/hotels.js";
import type { RateItemView } from "./schemas/hotel-rates.js";
import { ratePercentLabel } from "./labels.js";

/** A percent item's amounts: the percentage in hundredths, as the Rates import writes them. */
function percent(minor: number, maxMinor: number | null = null) {
  return { amount: { minor }, amountMax: maxMinor === null ? null : { minor: maxMinor } };
}

describe("ratePercentLabel", () => {
  it("reads a percent item's amount as hundredths of a percent", () => {
    expect(ratePercentLabel(percent(1000))).toBe("10%");
    expect(ratePercentLabel(percent(1250))).toBe("12.5%");
    expect(ratePercentLabel(percent(1875))).toBe("18.75%");
    expect(ratePercentLabel(percent(0))).toBe("0%");
  });

  it("shows a range with one en dash and one percent sign, and one value when its bounds agree", () => {
    expect(ratePercentLabel(percent(1800, 2000))).toBe("18–20%");
    expect(ratePercentLabel(percent(1800, 1800))).toBe("18%");
  });

  it("labels the client's and the staff's rate items alike", () => {
    const client: ClientRateItemView = {
      itemType: "service_charge",
      amount: { minor: 1000, currency: "INR" },
      amountMax: null,
      unit: "percent",
      inclusions: null,
    };
    const staff: RateItemView = {
      id: "018f0000-0000-7000-8000-0000000c1101",
      rateCardId: "018f0000-0000-7000-8000-0000000c1001",
      itemType: "tax",
      roomCategoryId: null,
      venueId: null,
      amount: { minor: 1800, currency: "INR" },
      amountMax: { minor: 2000, currency: "INR" },
      isIndicative: true,
      unit: "percent",
      minQuantity: null,
      inclusionsText: null,
      clientVisible: false,
    };
    expect(ratePercentLabel(client)).toBe("10%");
    expect(ratePercentLabel(staff)).toBe("18–20%");
  });
});
