import type { ClientRateItemView, HotelRatesView } from "@ampm/core";

import {
  destinationLabel,
  destinationOptions,
  formatDay,
  headlineCaption,
  headlineRate,
  hotelCountLabel,
  hotelMetaLine,
  hotelSections,
  percentLabel,
  rateFreshnessChip,
} from "./hotels.format";
import { detailFixture, hotelFixture, JAIPUR, UDAIPUR } from "./hotels.test-utils";

const AS_OF = "2026-11-02T06:30:00.000Z";

function item(overrides: Partial<ClientRateItemView>): ClientRateItemView {
  return {
    itemType: "room_rate",
    amount: { minor: 1800000, currency: "INR" },
    amountMax: { minor: 2400000, currency: "INR" },
    unit: "per_night",
    inclusions: null,
    ...overrides,
  };
}

function rates(
  status: HotelRatesView["status"],
  items: readonly ClientRateItemView[],
): HotelRatesView {
  return { status, asOf: AS_OF, items: [...items] };
}

describe("hotel labels", () => {
  it("names where a hotel is and how big it is", () => {
    expect(destinationLabel(UDAIPUR)).toBe("Udaipur, Rajasthan");
    expect(destinationLabel({ ...UDAIPUR, state: null })).toBe("Udaipur");
    expect(hotelMetaLine(hotelFixture())).toBe("Udaipur, Rajasthan · 84 rooms");
    expect(hotelMetaLine(hotelFixture({ totalRooms: null }))).toBe("Udaipur, Rajasthan");
  });

  it("counts results, saying when the page stops short of the end", () => {
    expect(hotelCountLabel(1, false)).toBe("1 hotel");
    expect(hotelCountLabel(14, false)).toBe("14 hotels");
    expect(hotelCountLabel(50, true)).toBe("50+ hotels");
  });

  it("formats a day and keeps a value it cannot read", () => {
    expect(formatDay(AS_OF)).toBe("2 Nov 2026");
    expect(formatDay("not a date")).toBe("not a date");
  });
});

describe("destinationOptions", () => {
  const udaipur = hotelFixture();
  const jaipur = hotelFixture({ id: "018f0000-0000-7000-8000-00000000cafe", destination: JAIPUR });

  it("offers each destination on screen once, by name", () => {
    expect(destinationOptions([udaipur, jaipur, udaipur], null)).toEqual([JAIPUR, UDAIPUR]);
  });

  it("keeps the chosen destination even when no result is in it", () => {
    expect(destinationOptions([udaipur], JAIPUR)).toEqual([JAIPUR, UDAIPUR]);
    expect(destinationOptions([], JAIPUR)).toEqual([JAIPUR]);
  });
});

describe("rates", () => {
  it("labels freshness as the guide's chips: verified, stale, on request", () => {
    expect(rateFreshnessChip(rates("verified", []))).toEqual({
      label: "Verified on 2 Nov 2026 by AMPM",
      tone: "success",
      dot: true,
    });
    expect(rateFreshnessChip(rates("stale", []))).toEqual({
      label: "Stale · checked 2 Nov 2026",
      tone: "neutral",
      dot: false,
    });
    expect(rateFreshnessChip({ status: "on_request", asOf: null, items: [] })).toEqual({
      label: "Rates on request",
      tone: "info",
      dot: false,
    });
    expect(rateFreshnessChip({ status: "verified", asOf: null, items: [] }).label).toBe(
      "Verified by AMPM",
    );
  });

  it("heads the footer with the room rate, then the wedding package, never a percentage", () => {
    const tax = item({ itemType: "tax", unit: "percent", amountMax: null });
    const plate = item({ itemType: "per_plate_veg", unit: "per_plate" });
    const wedding = item({ itemType: "wedding_package", unit: "per_event" });
    expect(headlineRate(rates("verified", [tax, plate, wedding, item({})]))?.itemType).toBe(
      "room_rate",
    );
    expect(headlineRate(rates("verified", [tax, plate, wedding]))?.itemType).toBe(
      "wedding_package",
    );
    expect(headlineRate(rates("verified", [tax, plate]))?.itemType).toBe("per_plate_veg");
    expect(headlineRate(rates("verified", [tax]))).toBeNull();
  });

  it("shows no headline amount for rates on request, even with items", () => {
    expect(headlineRate(rates("on_request", [item({})]))).toBeNull();
  });

  it("says what the headline price is for, and when it is stale", () => {
    expect(headlineCaption(item({}), rates("verified", []))).toBe("per room / night");
    expect(headlineCaption(item({}), rates("stale", []))).toBe("Stale · per room / night");
    expect(
      headlineCaption(
        item({ itemType: "wedding_package", unit: "per_event" }),
        rates("verified", []),
      ),
    ).toBe("Wedding package, per event");
  });

  it("reads a percentage item's amounts as hundredths of a percent", () => {
    expect(
      percentLabel(
        item({ unit: "percent", amount: { minor: 1800, currency: "INR" }, amountMax: null }),
      ),
    ).toBe("18%");
    expect(
      percentLabel(
        item({
          unit: "percent",
          amount: { minor: 1800, currency: "INR" },
          amountMax: { minor: 2000, currency: "INR" },
        }),
      ),
    ).toBe("18–20%");
  });
});

describe("hotelSections", () => {
  it("always offers the rates and adds what the API sent", () => {
    expect(hotelSections(detailFixture()).map((s) => s.value)).toEqual(["overview", "rates"]);
    expect(
      hotelSections(detailFixture({ description: null, address: null })).map((s) => s.value),
    ).toEqual(["rates"]);
  });

  it("counts pictures, not videos, for the gallery", () => {
    const media = (id: string, kind: "image" | "video") => ({
      id,
      kind,
      caption: null,
      thumbnailUrl: "https://media.test/t.jpg",
      webUrl: "https://media.test/w.jpg",
    });
    const gallery = [
      media("018f0000-0000-7000-8000-0000000000f1", "image"),
      media("018f0000-0000-7000-8000-0000000000f2", "video"),
    ];
    expect(hotelSections(detailFixture({ gallery }))).toContainEqual({
      value: "gallery",
      label: "Gallery",
      badge: 1,
    });
    const videoOnly = [media("018f0000-0000-7000-8000-0000000000f3", "video")];
    expect(hotelSections(detailFixture({ gallery: videoOnly })).map((s) => s.value)).toEqual([
      "overview",
      "rates",
    ]);
  });
});
