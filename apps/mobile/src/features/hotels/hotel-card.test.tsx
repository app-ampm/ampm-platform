import { renderWithProviders, screen } from "../../test/render";
import { HotelCard } from "./hotel-card";
import { hotelFixture, summaryFixture } from "./hotels.test-utils";

describe("HotelCard summary (B11)", () => {
  it("shows the indicative price range with its unit, a compact freshness chip and the capacity", async () => {
    await renderWithProviders(<HotelCard hotel={hotelFixture()} onPress={() => {}} />);
    expect(screen.getByText("₹18,000–24,000")).toBeOnTheScreen();
    expect(screen.getByText("/ night")).toBeOnTheScreen();
    expect(screen.getByText("Verified")).toBeOnTheScreen();
    expect(screen.getByText("Seats 500–900")).toBeOnTheScreen();
  });

  it("labels a stale price stale, keeping the amounts on screen", async () => {
    const hotel = hotelFixture({ summary: summaryFixture({ ratesFreshness: "stale" }) });
    await renderWithProviders(<HotelCard hotel={hotel} onPress={() => {}} />);
    expect(screen.getByText("Stale")).toBeOnTheScreen();
    expect(screen.getByText("₹18,000–24,000")).toBeOnTheScreen();
  });

  it("folds the price, freshness and capacity into the card's accessible name (WCAG 1.3.1)", async () => {
    // The pressable card collapses its children, so the summary rides on the name — a screen reader hears it.
    await renderWithProviders(<HotelCard hotel={hotelFixture()} onPress={() => {}} />);
    expect(screen.getByRole("button", { name: /₹18,000 to ₹24,000/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Rates verified/ })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Seats 500 to 900/ })).toBeOnTheScreen();
  });

  it("shows only the on-request chip when a hotel has no client-visible price or capacity", async () => {
    const hotel = hotelFixture({
      summary: summaryFixture({ ratesFreshness: "on_request", priceRange: null, capacity: null }),
    });
    await renderWithProviders(<HotelCard hotel={hotel} onPress={() => {}} />);
    expect(screen.getByText("On request")).toBeOnTheScreen();
    expect(screen.queryByText("/ night")).toBeNull();
    expect(screen.queryByText(/^Seats/)).toBeNull();
  });
});
