import { describe, expect, it } from "vitest";

import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import {
  CARD_ID,
  CARD_NAME,
  ITEM_ID,
  planRates,
  rateContext,
  ROOM_NAME,
  rupees,
  storedCard,
  VENUE_NAME,
} from "./testing/rate-plan-fixtures.js";
import { ROOM_ID, VENUE_ID } from "./testing/subresource-fixtures.js";

/*
 * What each row of a Rates file does (D-184, Slice 4): its hotel by web address, its card by name among
 * the hotel's live cards that are not retired, its item by type, room and venue within that card. A new
 * card is a draft one row creates for every row naming it; rates go only into draft cards; a new item is
 * hidden; a blank never clears. Synthetic data only.
 */

const NEW_CARD = "Synthetic season 2028";
const noCards = rateContext({ cards: [] });

describe("planRateRows: a card the file names for the first time", () => {
  it("creates a draft card and its hidden item, naming the card's and the item's filled columns", () => {
    const [plan] = planRates(
      [
        {
          cardName: NEW_CARD,
          validFrom: "2028-04-01",
          validTo: "2029-03-31",
          roomName: "synthetic lake  SUITE",
          amount: rupees(12_500),
          unit: "per_night",
        },
      ],
      noCards,
    );
    expect(plan).toMatchObject({
      outcome: "create",
      hotelId: HOTEL_ID,
      name: NEW_CARD,
      item: { itemType: "room_rate", roomName: ROOM_NAME, venueName: null },
      card: { kind: "new", name: NEW_CARD, validFrom: "2028-04-01", validTo: "2029-03-31" },
      data: {
        itemType: "room_rate",
        roomCategoryId: ROOM_ID,
        venueId: null,
        amount: rupees(12_500),
        amountMax: null,
        isIndicative: true,
        unit: "per_night",
        clientVisible: false,
      },
      changedFields: ["cardName", "validFrom", "validTo", "itemType", "roomName", "amount", "unit"],
    });
  });

  it("puts every row naming the card into it, once normalised, under the first row's name and dates", () => {
    const plans = planRates(
      [
        { cardName: NEW_CARD, roomName: ROOM_NAME, amount: rupees(12_500), unit: "per_night" },
        {
          cardName: "  synthetic SEASON 2028 ",
          itemType: "venue_rental",
          venueName: VENUE_NAME,
          amount: rupees(250_000),
          unit: "per_event",
        },
      ],
      noCards,
    );
    expect(plans[1]).toMatchObject({
      outcome: "create",
      name: NEW_CARD,
      card: { kind: "new", name: NEW_CARD, validFrom: null, validTo: null },
      data: { venueId: VENUE_ID, roomCategoryId: null },
      changedFields: ["itemType", "venueName", "amount", "unit"],
    });
    const [first, second] = plans;
    expect(first?.outcome === "create" && second?.outcome === "create").toBe(true);
    if (first?.outcome === "create" && second?.outcome === "create") {
      expect(second.card).toEqual(first.card);
    }
  });

  it("refuses a later row of the card whose filled dates differ from the first row's", () => {
    const plans = planRates(
      [
        { cardName: NEW_CARD, validFrom: "2028-04-01", amount: rupees(100), unit: "percent" },
        {
          cardName: NEW_CARD,
          itemType: "tax",
          validFrom: "2028-05-01",
          validTo: "2029-03-31",
          amount: rupees(18),
          unit: "percent",
        },
        { cardName: NEW_CARD, itemType: "other", amount: rupees(10), unit: "per_event" },
      ],
      noCards,
    );
    const message =
      "Line 2 starts this new card with other dates; give its rows the same dates, or leave them blank";
    expect(plans[1]).toMatchObject({
      outcome: "error",
      errors: [
        { field: "validFrom", message },
        { field: "validTo", message },
      ],
    });
    expect(plans[2]).toMatchObject({ outcome: "create", card: { validFrom: "2028-04-01" } });
  });

  it("lets the first row that can be imported create the card, with its own dates", () => {
    const plans = planRates(
      [
        { cardName: NEW_CARD, itemType: "tax", validFrom: "2028-04-01", unit: "percent" },
        { cardName: NEW_CARD, validFrom: "2028-06-01", amount: rupees(9_000), unit: "per_night" },
      ],
      noCards,
    );
    expect(plans[0]).toMatchObject({ outcome: "error" });
    expect(plans[1]).toMatchObject({
      outcome: "create",
      card: { validFrom: "2028-06-01" },
      changedFields: ["cardName", "validFrom", "itemType", "amount", "unit"],
    });
  });

  it("treats a retired card's name as free", () => {
    const retired = rateContext({ cards: [storedCard({ status: "retired" })] });
    const [plan] = planRates([{ amount: rupees(12_500), unit: "per_night" }], retired);
    expect(plan).toMatchObject({ outcome: "create", card: { kind: "new", name: CARD_NAME } });
  });
});

describe("planRateRows: a stored draft card", () => {
  it("adds an item to the card it matches by name, naming only the item's columns", () => {
    const [plan] = planRates([
      {
        cardName: " SYNTHETIC season  2027",
        itemType: "per_plate_veg",
        amount: rupees(1_800),
        unit: "per_plate",
        minQuantity: 150,
        isIndicative: false,
      },
    ]);
    expect(plan).toMatchObject({
      outcome: "create",
      name: CARD_NAME,
      card: { kind: "stored", cardId: CARD_ID },
      data: { isIndicative: false, minQuantity: 150, clientVisible: false },
      changedFields: ["itemType", "amount", "unit", "minQuantity", "isIndicative"],
    });
  });

  it("leaves a matched item whose filled cells hold what it holds, a blank never clearing", () => {
    const [plan] = planRates([{ roomName: ROOM_NAME, amount: rupees(12_500) }]);
    expect(plan).toMatchObject({ outcome: "unchanged", targetId: ITEM_ID, cardId: CARD_ID });
  });

  it("updates only the filled cells of a matched item that differ", () => {
    const [plan] = planRates([
      { roomName: ROOM_NAME, amount: rupees(13_000), inclusions: " Breakfast  for two " },
    ]);
    expect(plan).toMatchObject({
      outcome: "update",
      targetId: ITEM_ID,
      patch: { amount: rupees(13_000) },
      changedFields: ["amount"],
    });
    const [terms] = planRates([{ roomName: ROOM_NAME, minQuantity: 2, inclusions: "Dinner" }]);
    expect(terms).toMatchObject({
      outcome: "update",
      patch: { minQuantity: 2, inclusionsText: "Dinner" },
      changedFields: ["minQuantity", "inclusions"],
    });
  });

  it("keys an item by its type, room and venue: another room or no room is another item", () => {
    const [noRoom] = planRates([{ amount: rupees(12_500), unit: "per_night" }]);
    expect(noRoom).toMatchObject({ outcome: "create", data: { roomCategoryId: null } });
    const [venue] = planRates([
      { itemType: "venue_rental", venueName: VENUE_NAME, amount: rupees(1), unit: "per_event" },
    ]);
    expect(venue).toMatchObject({ outcome: "create", data: { venueId: VENUE_ID } });
  });

  it("refuses the same item named twice for one card on its later line, but not across cards", () => {
    const plans = planRates(
      [
        { roomName: ROOM_NAME, amount: rupees(13_000) },
        { roomName: ROOM_NAME, amount: rupees(14_000) },
        { cardName: NEW_CARD, roomName: ROOM_NAME, amount: rupees(1), unit: "per_night" },
      ],
      rateContext(),
    );
    expect(plans.map((plan) => plan.outcome)).toEqual(["update", "error", "create"]);
    expect(plans[1]).toMatchObject({
      errors: [{ field: "itemType", message: "Line 2 already names this item" }],
    });
  });

  it("refuses a row whose filled dates differ from the card's: an import never changes a card", () => {
    const [plan] = planRates([{ roomName: ROOM_NAME, validTo: "2028-02-29" }]);
    expect(plan).toMatchObject({
      outcome: "error",
      errors: [
        {
          field: "validTo",
          message: "This card's dates differ from the file's; change them in the staff app",
        },
      ],
    });
    const [same] = planRates([{ roomName: ROOM_NAME, validFrom: "2027-04-01" }]);
    expect(same).toMatchObject({ outcome: "unchanged" });
  });
});
