import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { HotelFiltersButton } from "./hotel-filter-sheet";
import type { HotelFilters } from "./hotels.format";

async function setup(value: HotelFilters = {}) {
  const onChange = jest.fn();
  await renderWithProviders(<HotelFiltersButton value={value} onChange={onChange} />);
  return { onChange };
}

describe("HotelFiltersButton (P3)", () => {
  it("reads 'Filters' with nothing set, and opens the sheet of filter rows", async () => {
    await setup();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    expect(await screen.findByText("Star rating")).toBeOnTheScreen();
    expect(screen.getByText("Guest capacity")).toBeOnTheScreen();
    expect(screen.getByText("Hotel size")).toBeOnTheScreen();
    // Every value reads in full, not "Any …".
    expect(screen.getByRole("button", { name: "1,000+ guests" })).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-filter-star-option-any")).toBeSelected();
  });

  it("counts the sheet's filters that are set, leaving verified rates to its own chip", async () => {
    await setup({ star: "5", minRooms: 100, verifiedRatesOnly: true });
    expect(screen.getByRole("button", { name: "Filters, 2" })).toBeOnTheScreen();
    expect(screen.getByText("Filters · 2")).toBeOnTheScreen();
  });

  it("applies a choice as it is made, mapping a minimum to a number", async () => {
    const { onChange } = await setup({ star: "4" });
    await fireEvent.press(screen.getByRole("button", { name: "Filters, 1" }));
    await fireEvent.press(await screen.findByTestId("hotel-filter-capacity-option-500"));
    expect(onChange).toHaveBeenCalledWith({ star: "4", minGuestCapacity: 500 });
  });

  it("clears the sheet's filters and keeps verified rates", async () => {
    const { onChange } = await setup({ star: "5", minGuestCapacity: 200, verifiedRatesOnly: true });
    await fireEvent.press(screen.getByRole("button", { name: "Filters, 2" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith({ verifiedRatesOnly: true });
  });

  it("offers no Clear with nothing set, and closes over the results", async () => {
    await setup();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    expect(await screen.findByText("Star rating")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    await fireEvent.press(screen.getByTestId("hotel-filter-sheet-done"));
    expect(screen.queryByText("Star rating")).toBeNull();
  });
});
