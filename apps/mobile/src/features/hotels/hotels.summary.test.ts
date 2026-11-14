import {
  capacityRangeLabel,
  cardFreshnessChip,
  priceRangeAmounts,
  priceRangeUnit,
  rateUnitLabel,
} from "./hotels.format";
import { summaryFixture } from "./hotels.test-utils";

describe("card summary labels (B11)", () => {
  it("gives a compact freshness chip — the one-word state, no date (that is the detail's)", () => {
    expect(cardFreshnessChip(summaryFixture())).toEqual({
      label: "Verified",
      tone: "success",
      dot: true,
    });
    expect(cardFreshnessChip(summaryFixture({ ratesFreshness: "stale" }))).toEqual({
      label: "Stale",
      tone: "neutral",
      dot: false,
    });
    expect(
      cardFreshnessChip(summaryFixture({ ratesFreshness: "on_request", priceRange: null })),
    ).toEqual({ label: "On request", tone: "info", dot: false });
  });

  it("reads the price range as the two client amounts MoneyText takes, with a short unit", () => {
    const { amount, amountMax } = priceRangeAmounts({
      min: { minor: 1800000, currency: "INR" },
      max: { minor: 2400000, currency: "INR" },
      unit: "per_night",
    });
    expect([amount.minor, amountMax.minor]).toEqual([1800000, 2400000]);
    expect(priceRangeUnit("per_night")).toBe("/ night");
    // a non-nightly unit falls back to the full unit label (no bespoke "/ x" shorthand)
    expect(priceRangeUnit("per_event")).toBe(rateUnitLabel("per_event"));
  });

  it("labels the capacity range, collapsing a single value", () => {
    expect(capacityRangeLabel({ min: 500, max: 900 })).toBe("Seats 500–900");
    expect(capacityRangeLabel({ min: 400, max: 400 })).toBe("Seats 400");
  });
});
