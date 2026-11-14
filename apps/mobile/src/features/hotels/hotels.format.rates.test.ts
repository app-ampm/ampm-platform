import type { ClientRateItemView } from "@ampm/core";

import { groupRateItems } from "./hotels.format.rates";

function item(itemType: ClientRateItemView["itemType"]): ClientRateItemView {
  return {
    itemType,
    amount: { minor: 100000, currency: "INR" },
    amountMax: null,
    unit: "per_night",
    inclusions: null,
  };
}

describe("groupRateItems (B18)", () => {
  it("orders the categories: rooms & venues, then food & beverage, then charges", () => {
    const groups = groupRateItems([
      item("tax"),
      item("room_rate"),
      item("per_plate_veg"),
      item("beverage_package"),
      item("venue_rental"),
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Rooms & venues",
      "Food & beverage",
      "Charges & taxes",
    ]);
  });

  it("keeps each item in its own category, in the order it was given", () => {
    const groups = groupRateItems([
      item("venue_rental"),
      item("service_charge"),
      item("room_rate"),
      item("per_plate_non_veg"),
      item("wedding_package"),
    ]);
    expect(groups[0]?.items.map((i) => i.itemType)).toEqual(["venue_rental", "room_rate"]);
    expect(groups[1]?.items.map((i) => i.itemType)).toEqual([
      "per_plate_non_veg",
      "wedding_package",
    ]);
    expect(groups[2]?.items.map((i) => i.itemType)).toEqual(["service_charge"]);
  });

  it("omits a category with no items, and groups nothing for no items", () => {
    expect(groupRateItems([item("room_rate")]).map((group) => group.label)).toEqual([
      "Rooms & venues",
    ]);
    expect(groupRateItems([])).toEqual([]);
  });
});
