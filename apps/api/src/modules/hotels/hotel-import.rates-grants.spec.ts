import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { rateImportGrantsOf } from "./hotel-audience.js";
import { rateMatchOf } from "./hotel-import.rates-plan.js";
import {
  CARD_ID,
  ITEM_ID,
  OTHER_CARD_ID,
  OTHER_ITEM_ID,
  planRates,
  rateContext,
  ROOM_NAME,
  rupees,
  storedCard,
  storedItem,
  VENUE_NAME,
} from "./testing/rate-plan-fixtures.js";

/*
 * A Rates file's rows are held to the uploader's own keys (D-184, D-164; custom roles are live): creating
 * a card or an item needs the create key, changing an item the update key, naming a stored card at all
 * the read key, and naming a room or venue the rooms and venues read key, so a preview never tells an
 * uploader whether a row matches a card, an item, a room or a venue they cannot read. And what each plan
 * matched, which the import's "Changed since preview" check reads.
 */

const NEW_CARD = "Synthetic season 2028";
const CANNOT_READ_CARDS = "A rate card already has this name, and you cannot read rate cards";

describe("rateImportGrantsOf", () => {
  it("gives the Hotel team every rates key, and a custom role only its own", () => {
    expect(rateImportGrantsOf(staffPrincipal(["HT"]))).toEqual({
      canCreate: true,
      canUpdate: true,
      readsCards: true,
      readsRoomsVenues: true,
    });
    const createOnly = staffPrincipal([], ["hotels.rate_cards_rate_items.create:all"]);
    expect(rateImportGrantsOf(createOnly)).toEqual({
      canCreate: true,
      canUpdate: false,
      readsCards: false,
      readsRoomsVenues: false,
    });
  });
});

describe("planRateRows: the uploader's own keys", () => {
  it("needs the create key to add a card or an item", () => {
    const blind = (cards = [storedCard()]) => rateContext({ cards, grants: { canCreate: false } });
    expect(
      planRates([{ cardName: NEW_CARD, amount: rupees(1), unit: "percent" }], blind())[0],
    ).toMatchObject({
      outcome: "error",
      errors: [{ field: "cardName", message: "You cannot add rate cards" }],
    });
    expect(
      planRates([{ itemType: "tax", amount: rupees(1), unit: "percent" }], blind())[0],
    ).toMatchObject({
      outcome: "error",
      errors: [{ field: "itemType", message: "You cannot add rate items" }],
    });
  });

  it("needs the update key to change an item, but not to leave one alone", () => {
    const viewer = rateContext({ grants: { canUpdate: false } });
    expect(planRates([{ roomName: ROOM_NAME, amount: rupees(13_000) }], viewer)[0]).toMatchObject({
      outcome: "error",
      errors: [
        {
          field: "itemType",
          message: "This card already has this item, and you cannot change rate items",
        },
      ],
    });
    expect(planRates([{ roomName: ROOM_NAME }], viewer)[0]).toMatchObject({ outcome: "unchanged" });
  });

  it("refuses a row naming a stored card to an uploader who cannot read cards, by one reason", () => {
    const blind = (cards = [storedCard()]) => rateContext({ cards, grants: { readsCards: false } });
    const refused = {
      outcome: "error",
      errors: [{ field: "cardName", message: CANNOT_READ_CARDS }],
    };
    for (const cells of [
      { roomName: ROOM_NAME },
      { roomName: "Synthetic Nowhere", validTo: "2030-01-01" },
    ]) {
      expect(planRates([cells], blind())[0]).toMatchObject(refused);
    }
    expect(planRates([{}], blind([storedCard({ status: "verified" })]))[0]).toMatchObject(refused);
    const twins = blind([storedCard(), storedCard({ id: OTHER_CARD_ID })]);
    expect(planRates([{}], twins)[0]).toMatchObject(refused);
    const fresh = planRates([{ cardName: NEW_CARD, amount: rupees(1), unit: "percent" }], blind());
    expect(fresh[0]).toMatchObject({ outcome: "create" });
  });

  it("refuses a room or venue to an uploader who cannot read rooms and venues", () => {
    const blind = rateContext({ grants: { readsRoomsVenues: false } });
    const plans = planRates(
      [
        { roomName: ROOM_NAME },
        { itemType: "venue_rental", venueName: VENUE_NAME },
        { itemType: "tax", amount: rupees(18), unit: "percent" },
      ],
      blind,
    );
    expect(plans.map((plan) => plan.outcome === "error" && plan.errors)).toEqual([
      [{ field: "roomName", message: "You cannot read rooms and venues" }],
      [{ field: "venueName", message: "You cannot read rooms and venues" }],
      false,
    ]);
  });

  it("refuses a new card's room to such an uploader too, whether or not the room exists", () => {
    const blind = rateContext({ cards: [], grants: { readsRoomsVenues: false } });
    const unread = [{ field: "roomName", message: "You cannot read rooms and venues" }];
    for (const roomName of [ROOM_NAME, "Synthetic Nowhere Suite"]) {
      const [plan] = planRates(
        [{ cardName: NEW_CARD, roomName, amount: rupees(9_000), unit: "per_night" }],
        blind,
      );
      expect(plan).toMatchObject({ outcome: "error", errors: unread });
    }
  });
});

describe("rateMatchOf: what a plan matched, refused or not", () => {
  const matchOf = (...args: Parameters<typeof planRates>) => {
    const [plan] = planRates(...args);
    return plan === undefined ? undefined : rateMatchOf(plan);
  };

  it("names the item a row matched, whether it updates it, leaves it or is refused on it", () => {
    const item = { matches: "row", targetId: ITEM_ID };
    expect(matchOf([{ roomName: ROOM_NAME, amount: rupees(13_000) }])).toEqual(item);
    expect(matchOf([{ roomName: ROOM_NAME }])).toEqual(item);
    const verified = rateContext({ cards: [storedCard({ status: "verified" })] });
    expect(matchOf([{ roomName: ROOM_NAME }], verified)).toEqual(item);
    expect(
      matchOf([{ roomName: ROOM_NAME }], rateContext({ grants: { readsCards: false } })),
    ).toEqual(item);
  });

  it("names the card a row matched no single item in", () => {
    const card = { matches: "none", parentId: CARD_ID };
    expect(matchOf([{ itemType: "tax", amount: rupees(1), unit: "percent" }])).toEqual(card);
    expect(matchOf([{ roomName: "Synthetic Nowhere" }])).toEqual(card);
    const items = [storedItem(), storedItem({ id: OTHER_ITEM_ID })];
    expect(
      matchOf([{ roomName: ROOM_NAME }], rateContext({ cards: [storedCard({ items })] })),
    ).toEqual(card);
  });

  it("names no card for a new one, and nothing for a row refused before its card", () => {
    expect(matchOf([{ cardName: NEW_CARD, amount: rupees(1), unit: "percent" }])).toEqual({
      matches: "none",
    });
    expect(matchOf([{ hotelSlug: "synthetic-nowhere" }])).toEqual({ matches: "unmatched" });
    const twins = rateContext({ cards: [storedCard(), storedCard({ id: OTHER_CARD_ID })] });
    expect(matchOf([{}], twins)).toEqual({ matches: "unmatched" });
  });
});
