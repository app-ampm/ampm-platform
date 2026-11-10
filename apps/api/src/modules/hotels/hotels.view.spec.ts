import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import { toCardSummary } from "./hotels.view.js";
import type { HotelDetailRow } from "./hotels.repository.js";

type Card = HotelDetailRow["rateCards"][number];
type Item = Card["items"][number];
type Venue = { capacityBanquet: number | null; capacityReception: number | null };

const dec = (rupees: number) => new Prisma.Decimal(rupees);

function item(
  itemType: Item["itemType"],
  amount: number,
  amountMax: number | null = null,
  unit: Item["unit"] = "per_night",
): Item {
  return {
    itemType,
    amount: dec(amount),
    amountMax: amountMax != null ? dec(amountMax) : null,
    unit,
    inclusionsText: null,
  };
}

function card(status: Card["status"], verifiedAt: Date | null, items: Item[]): Card {
  return { status, verification: verifiedAt ? { verifiedAt } : null, items };
}

const AT = new Date("2026-11-02T06:30:00.000Z");

describe("toCardSummary (B11 — the card figures derived from the detail's own rate/venue data)", () => {
  it("ranges a verified room rate (per night), labels it verified with the newest date, and ranges capacity", () => {
    const cards = [
      card("verified", AT, [item("room_rate", 18000, 24000), item("room_rate", 20000)]),
    ];
    const venues: Venue[] = [
      { capacityBanquet: 500, capacityReception: 900 },
      { capacityBanquet: 300, capacityReception: null },
    ];
    expect(toCardSummary(cards, venues)).toEqual({
      ratesFreshness: "verified",
      ratesAsOf: AT.toISOString(),
      // lowest amount (20,000 vs 18,000) → 18,00,000 paise; highest upper bound (24,000) → 24,00,000 paise.
      priceRange: {
        min: { minor: 1800000, currency: "INR" },
        max: { minor: 2400000, currency: "INR" },
        unit: "per_night",
      },
      capacity: { min: 300, max: 900 },
    });
  });

  it("draws the range from one rate type only, so per-night and per-event never mix", () => {
    const cards = [
      card("verified", AT, [
        item("wedding_package", 500000, 800000, "per_event"),
        item("room_rate", 18000, 24000),
      ]),
    ];
    const summary = toCardSummary(cards, []);
    // room_rate wins the priority, so the range is the per-night one — the package amount is excluded.
    expect(summary.priceRange).toEqual({
      min: { minor: 1800000, currency: "INR" },
      max: { minor: 2400000, currency: "INR" },
      unit: "per_night",
    });
    expect(summary.capacity).toBeNull(); // no venues
  });

  it("falls back to the wedding package when there is no room rate", () => {
    const cards = [card("verified", AT, [item("wedding_package", 500000, null, "per_event")])];
    expect(toCardSummary(cards, []).priceRange).toEqual({
      min: { minor: 50000000, currency: "INR" },
      max: { minor: 50000000, currency: "INR" }, // no amountMax → upper bound is the amount
      unit: "per_event",
    });
  });

  it("ranges only one unit within a type, so a per-event and a per-plate package never span one figure", () => {
    const cards = [
      card("verified", AT, [
        item("wedding_package", 500000, 800000, "per_event"),
        item("wedding_package", 2500, 3000, "per_plate"),
      ]),
    ];
    // The first wedding_package item is per_event, so the range stays per_event; the per_plate item is excluded.
    expect(toCardSummary(cards, []).priceRange).toEqual({
      min: { minor: 50000000, currency: "INR" },
      max: { minor: 80000000, currency: "INR" },
      unit: "per_event",
    });
  });

  it("keeps stale amounts but labels them stale; omits a price when no listed type is priced", () => {
    const stale = toCardSummary([card("stale", AT, [item("room_rate", 18000)])], []);
    expect(stale.ratesFreshness).toBe("stale");
    expect(stale.priceRange?.min).toEqual({ minor: 1800000, currency: "INR" });

    // A card priced only in a non-headline type (e.g. venue rental) yields the freshness label but no range.
    const other = toCardSummary([card("verified", AT, [item("venue_rental", 90000)])], []);
    expect(other.ratesFreshness).toBe("verified");
    expect(other.priceRange).toBeNull();
  });

  it("is on request with no price when there are no verified or stale cards", () => {
    expect(toCardSummary([], [{ capacityBanquet: 400, capacityReception: null }])).toEqual({
      ratesFreshness: "on_request",
      ratesAsOf: null,
      priceRange: null,
      capacity: { min: 400, max: 400 },
    });
  });
});
