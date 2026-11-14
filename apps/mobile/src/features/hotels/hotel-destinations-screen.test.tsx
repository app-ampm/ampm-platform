import type { DestinationBrowseItem, HotelDestinationView } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { HotelDestinationsScreen } from "./hotel-destinations-screen";
import { fakeApi, JAIPUR, ok, renderWithApi, UDAIPUR } from "./hotels.test-utils";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
}));

// A list on a phone and a tablet, D3's tiles three across from 1024.
const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const UDAIPUR_D: DestinationBrowseItem = { ...UDAIPUR, hotelCount: 5 };
const JAIPUR_D: DestinationBrowseItem = { ...JAIPUR, hotelCount: 1 };
const GOA_ID = "018f0000-0000-7000-8000-0000000000a1";
const KERALA_ID = "018f0000-0000-7000-8000-0000000000a2";

function destinationsApi(items: readonly DestinationBrowseItem[]) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === "/hotels/destinations" ? ok({ items }) : undefined,
  );
}

beforeEach(() => {
  mockWindow.width = 390;
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

  it("keeps the list below 1024", async () => {
    mockWindow.width = 768;
    await renderWithApi(<HotelDestinationsScreen />, destinationsApi([UDAIPUR_D, JAIPUR_D]).fetch);
    expect(await screen.findByText("5 hotels · Rajasthan")).toBeOnTheScreen();
    expect(screen.queryByTestId("destination-tiles")).toBeNull();
  });

  it("shows the destinations as tiles three across from 1024, each opening its hotels", async () => {
    mockWindow.width = 1440;
    const goa: HotelDestinationView = {
      ...UDAIPUR,
      id: GOA_ID,
      name: "Goa",
      region: null,
      state: "Goa",
    };
    const items = [
      UDAIPUR_D,
      JAIPUR_D,
      { ...goa, hotelCount: 2 },
      { ...goa, id: KERALA_ID, name: "Kerala", hotelCount: 3 },
    ];
    await renderWithApi(<HotelDestinationsScreen />, destinationsApi(items).fetch);
    const tiles = await screen.findByTestId("destination-tiles");
    expect(
      tiles.children.map((row) => (typeof row === "string" ? 0 : row.children.length)),
    ).toEqual([3, 3]);
    expect(screen.getByRole("image", { name: "Destination photo · Udaipur" })).toBeOnTheScreen();
    expect(screen.getByText("5 hotels")).toBeOnTheScreen();
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
