import { describe, expect, it } from "vitest";

import {
  CARD_NAME,
  GONE,
  LAKE,
  OTHER_CARD_ID,
  OTHER_ITEM_ID,
  planRates,
  rateContext,
  ROOM_NAME,
  rupees,
  storedCard,
  storedItem,
} from "./testing/rate-plan-fixtures.js";
import { ROOM_ID } from "./testing/subresource-fixtures.js";

/*
 * Why the rates planner refuses a row (D-184, Slice 4), each with words saying what to do: a card that is
 * not a draft, a name or an item that is not one stored row, a reference that resolves to no live room or
 * venue, a new item without its amount or unit, an upper bound below its amount. Synthetic data only.
 */

describe("planRateRows: refusals", () => {
  const cardRefusal = (status: "verified" | "stale") =>
    `Rates are imported only into draft cards, and this card is ${status}; give the file a new card name`;

  it("loads nothing into a verified or stale card", () => {
    for (const status of ["verified", "stale"] as const) {
      const [plan] = planRates(
        [{ roomName: ROOM_NAME, amount: rupees(13_000) }],
        rateContext({ cards: [storedCard({ status })] }),
      );
      expect(plan).toMatchObject({
        outcome: "error",
        errors: [{ field: "cardName", message: cardRefusal(status) }],
      });
    }
  });

  it("refuses a name two live cards share, and an item two stored items share", () => {
    const twins = rateContext({ cards: [storedCard(), storedCard({ id: OTHER_CARD_ID })] });
    expect(planRates([{ roomName: ROOM_NAME }], twins)[0]).toMatchObject({
      errors: [
        {
          field: "cardName",
          message: `Two rate cards are named ${CARD_NAME}; rename one in the staff app first`,
        },
      ],
    });
    const items = [storedItem(), storedItem({ id: OTHER_ITEM_ID })];
    const doubled = rateContext({ cards: [storedCard({ items })] });
    expect(planRates([{ roomName: ROOM_NAME }], doubled)[0]).toMatchObject({
      errors: [
        {
          field: "itemType",
          message: "This card has two such items; change one in the staff app first",
        },
      ],
    });
  });

  it("refuses an unknown room or venue, and a name two live rooms share", () => {
    const plans = planRates([
      { roomName: "Synthetic Garden Suite" },
      { itemType: "venue_rental", venueName: "Synthetic Terrace" },
    ]);
    expect(plans.map((plan) => plan.outcome === "error" && plan.errors)).toEqual([
      [{ field: "roomName", message: "No room named Synthetic Garden Suite" }],
      [{ field: "venueName", message: "No venue named Synthetic Terrace" }],
    ]);
    const rooms = [
      { id: ROOM_ID, name: ROOM_NAME },
      { id: OTHER_ITEM_ID, name: "SYNTHETIC LAKE SUITE" },
    ];
    expect(planRates([{ roomName: ROOM_NAME }], rateContext({ rooms }))[0]).toMatchObject({
      errors: [
        {
          field: "roomName",
          message: `Two rooms are named ${ROOM_NAME}; rename one in the staff app first`,
        },
      ],
    });
  });

  it("refuses a row naming no hotel, or a deleted one", () => {
    const plans = planRates([{ hotelSlug: "synthetic-nowhere" }, { hotelSlug: GONE }]);
    expect(plans.map((plan) => plan.outcome === "error" && plan.errors)).toEqual([
      [{ field: "hotelSlug", message: "No hotel has this web address" }],
      [{ field: "hotelSlug", message: "This hotel was deleted" }],
    ]);
  });

  it("needs a new item's amount and unit, and an upper bound not below its amount", () => {
    expect(planRates([{ itemType: "tax" }])[0]).toMatchObject({
      outcome: "error",
      errors: [
        { field: "amount", message: "A new item needs its amount" },
        {
          field: "unit",
          message: "A new item needs its unit: per night, per plate, per event or percent",
        },
      ],
    });
    const [below] = planRates([
      { itemType: "tax", amount: rupees(18), amountMax: rupees(12), unit: "percent" },
    ]);
    expect(below).toMatchObject({
      errors: [{ field: "amountMax", message: "amountMax must be at least amount" }],
    });
  });

  it("holds a matched item's new bound to its stored amount, and its new amount to its stored bound", () => {
    const [max] = planRates([{ roomName: ROOM_NAME, amountMax: rupees(12_000) }]);
    expect(max).toMatchObject({
      errors: [{ field: "amountMax", message: "amountMax must be at least amount" }],
    });
    const [amount] = planRates([{ roomName: ROOM_NAME, amount: rupees(16_000) }]);
    expect(amount).toMatchObject({
      errors: [{ field: "amount", message: "amountMax must be at least amount" }],
    });
    const [both] = planRates([
      { roomName: ROOM_NAME, amount: rupees(16_000), amountMax: rupees(18_000) },
    ]);
    expect(both).toMatchObject({ outcome: "update", changedFields: ["amount", "amountMax"] });
  });

  it("reports a refused row by its own cells", () => {
    const [plan] = planRates([
      { hotelSlug: LAKE, roomName: " synthetic lake suite ", amountMax: rupees(1) },
    ]);
    expect(plan).toMatchObject({
      outcome: "error",
      slug: LAKE,
      name: CARD_NAME,
      item: { itemType: "room_rate", roomName: " synthetic lake suite ", venueName: null },
    });
  });
});
