import type { RateItemView } from "@ampm/core";

import { renderWithProviders, screen } from "../../test/render";
import {
  rateItemViewFixture,
  ROOM_ID,
  roomCategoryViewFixture,
  VENUE_ID,
  venueViewFixture,
} from "./hotels-admin.test-utils";
import { RateItemRow } from "./rate-item-row";

const PLACES = {
  rooms: [roomCategoryViewFixture({ name: "Lake View Suite" })],
  venues: [venueViewFixture()],
};
const GONE_ID = "018f0000-0000-7000-8000-0000000c0d99";

const noop = (): void => {};

async function renderRow(item: RateItemView) {
  await renderWithProviders(
    <RateItemRow item={item} places={PLACES} onEdit={noop} onDelete={noop} />,
  );
}

/** A percent item as the Rates import writes it: the percentage in hundredths. */
function percentItem(minor: number, maxMinor: number | null): RateItemView {
  return rateItemViewFixture({
    itemType: "service_charge",
    unit: "percent",
    amount: { minor, currency: "INR" },
    amountMax: maxMinor === null ? null : { minor: maxMinor, currency: "INR" },
  });
}

describe("RateItemRow", () => {
  it("shows a percent item as its percentage, never as rupees with a unit", async () => {
    await renderRow(percentItem(1000, null));
    expect(screen.getByText("10%")).toBeOnTheScreen();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText("%")).toBeNull();
  });

  it("shows a percent range with one percent sign", async () => {
    await renderRow(percentItem(1800, 2000));
    expect(screen.getByText("18–20%")).toBeOnTheScreen();
  });

  it("shows a money item's amount or range in rupees and its unit", async () => {
    await renderRow(rateItemViewFixture());
    expect(screen.getByText("₹16,000–24,000")).toBeOnTheScreen();
    expect(screen.getByText("per night")).toBeOnTheScreen();
  });

  it("names the room an item prices, in its title and its actions' labels", async () => {
    await renderRow(rateItemViewFixture({ roomCategoryId: ROOM_ID }));
    expect(screen.getByText("Room rate · Lake View Suite")).toBeOnTheScreen();
    expect(screen.getByLabelText("Edit Room rate for Lake View Suite")).toBeOnTheScreen();
    expect(screen.getByLabelText("Delete Room rate for Lake View Suite")).toBeOnTheScreen();
  });

  it("names the venue a rental prices", async () => {
    await renderRow(rateItemViewFixture({ itemType: "venue_rental", venueId: VENUE_ID }));
    expect(screen.getByText("Venue rental · Grand Ballroom")).toBeOnTheScreen();
    expect(screen.getByLabelText("Edit Venue rental for Grand Ballroom")).toBeOnTheScreen();
  });

  it("says a removed room or venue when the hotel no longer has it", async () => {
    await renderRow(rateItemViewFixture({ roomCategoryId: GONE_ID }));
    expect(screen.getByText("Room rate · a removed room")).toBeOnTheScreen();
    expect(screen.getByLabelText("Delete Room rate for a removed room")).toBeOnTheScreen();
  });

  it("says a removed venue the same way", async () => {
    await renderRow(rateItemViewFixture({ itemType: "venue_rental", venueId: GONE_ID }));
    expect(screen.getByText("Venue rental · a removed venue")).toBeOnTheScreen();
  });

  it("shows the type alone until the hotel's rooms and venues are loaded", async () => {
    await renderWithProviders(
      <RateItemRow
        item={rateItemViewFixture({ roomCategoryId: ROOM_ID })}
        places={undefined}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText("Room rate")).toBeOnTheScreen();
    expect(screen.getByLabelText("Edit Room rate")).toBeOnTheScreen();
  });
});
