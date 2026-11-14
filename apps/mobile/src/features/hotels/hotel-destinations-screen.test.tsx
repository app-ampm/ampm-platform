import type { DestinationBrowseItem } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { HotelDestinationsScreen } from "./hotel-destinations-screen";
import { fakeApi, JAIPUR, ok, renderWithApi, UDAIPUR } from "./hotels.test-utils";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
}));

const UDAIPUR_D: DestinationBrowseItem = { ...UDAIPUR, hotelCount: 5 };
const JAIPUR_D: DestinationBrowseItem = { ...JAIPUR, hotelCount: 1 };

function destinationsApi(items: readonly DestinationBrowseItem[]) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === "/hotels/destinations" ? ok({ items }) : undefined,
  );
}

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
});

describe("HotelDestinationsScreen", () => {
  it("lists the destinations with their hotel counts and opens one", async () => {
    await renderWithApi(<HotelDestinationsScreen />, destinationsApi([UDAIPUR_D, JAIPUR_D]).fetch);
    expect(await screen.findByText("Udaipur")).toBeOnTheScreen();
    expect(screen.getByText("5 hotels · Rajasthan")).toBeOnTheScreen();
    expect(screen.getByText("Jaipur")).toBeOnTheScreen();
    expect(screen.getByText("1 hotel · Rajasthan")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Udaipur, 5 hotels · Rajasthan" }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/destinations/[id]",
      params: { id: UDAIPUR.id, name: "Udaipur" },
    });
  });

  it("says so when there are no destinations", async () => {
    await renderWithApi(<HotelDestinationsScreen />, destinationsApi([]).fetch);
    expect(await screen.findByText("No destinations yet")).toBeOnTheScreen();
  });
});
