import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { HotelFilterBar } from "./hotel-filters";
import type { HotelFilters } from "./hotels.format";

async function setup(value: HotelFilters = {}) {
  const onChange = jest.fn();
  await renderWithProviders(<HotelFilterBar value={value} onChange={onChange} />);
  return { onChange };
}

describe("HotelFilterBar", () => {
  it("applies a star rating, passing the chosen value up", async () => {
    const { onChange } = await setup();
    await fireEvent.press(screen.getByTestId("hotel-filter-star"));
    await fireEvent.press(await screen.findByTestId("hotel-filter-star-option-5"));
    expect(onChange).toHaveBeenCalledWith({ star: "5" });
  });

  it("maps a guest-capacity choice to a number", async () => {
    const { onChange } = await setup({ minGuestCapacity: 200 });
    await fireEvent.press(screen.getByTestId("hotel-filter-capacity"));
    await fireEvent.press(await screen.findByTestId("hotel-filter-capacity-option-1000"));
    expect(onChange).toHaveBeenCalledWith({ minGuestCapacity: 1000 });
  });

  it("clears a filter when 'any' is chosen", async () => {
    const { onChange } = await setup({ minRooms: 100 });
    await fireEvent.press(screen.getByTestId("hotel-filter-rooms"));
    await fireEvent.press(await screen.findByTestId("hotel-filter-rooms-option-any"));
    expect(onChange).toHaveBeenCalledWith({ minRooms: undefined });
  });

  it("toggles verified-rates-only on", async () => {
    const { onChange } = await setup();
    await fireEvent.press(screen.getByRole("button", { name: "Verified rates only" }));
    expect(onChange).toHaveBeenCalledWith({ verifiedRatesOnly: true });
  });

  it("turns verified-rates-only off when it is already on", async () => {
    const { onChange } = await setup({ verifiedRatesOnly: true });
    await fireEvent.press(screen.getByRole("button", { name: "Verified rates only" }));
    expect(onChange).toHaveBeenCalledWith({ verifiedRatesOnly: undefined });
  });
});
