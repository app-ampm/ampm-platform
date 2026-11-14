import type * as ReactModule from "react";
import { act, fireEvent, screen } from "../../test/render";
import { DestinationHotelsScreen } from "./destination-hotels-screen";
import {
  clientMe,
  fakeApi,
  hotelFixture,
  JAIPUR,
  ok,
  pageOf,
  renderWithApi,
} from "./hotels.test-utils";

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
}));

/** The window as a store its readers subscribe to, so a resize re-renders them as React Native's hook does. */
const mockWindow = { width: 390, listeners: new Set<() => void>() };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  const subscribe = (listener: () => void) => {
    mockWindow.listeners.add(listener);
    return () => mockWindow.listeners.delete(listener);
  };
  return {
    __esModule: true,
    default: function useMockWindowDimensions() {
      const width = react.useSyncExternalStore(subscribe, () => mockWindow.width);
      return { width, height: 900, scale: 2, fontScale: 1 };
    },
  };
});

const PAVILION = hotelFixture();
const HAVELI = hotelFixture({
  id: "018f0000-0000-7000-8000-00000000cafe",
  name: "Amber Haveli",
  destination: JAIPUR,
});
const DEST_ID = "018f0000-0000-7000-8000-000000000000";

beforeEach(() => {
  mockWindow.width = 390;
  mockBack.mockClear();
  mockPush.mockClear();
});

describe("DestinationHotelsScreen", () => {
  it("lists the destination's hotels under its name, filtered to it", async () => {
    const api = fakeApi((method, url) =>
      method === "GET" && url.pathname === "/hotels" ? ok(pageOf([PAVILION])) : undefined,
    );
    await renderWithApi(
      <DestinationHotelsScreen destinationId={DEST_ID} destinationName="Udaipur" />,
      api.fetch,
    );
    expect(await screen.findByRole("header", { name: "Udaipur" })).toBeOnTheScreen();
    expect(
      await screen.findByRole("button", { name: /The Lake Pavilion in Udaipur, Rajasthan/ }),
    ).toBeOnTheScreen();
    expect(api.calls.some((call) => call.includes(`destinationId=${DEST_ID}`))).toBe(true);
  });

  it("shows the results two per row from 1024, as the search does", async () => {
    mockWindow.width = 1440;
    const api = fakeApi((method, url) =>
      method === "GET" && url.pathname === "/hotels" ? ok(pageOf([PAVILION, HAVELI])) : undefined,
    );
    await renderWithApi(<DestinationHotelsScreen destinationId={DEST_ID} />, api.fetch);
    await screen.findByText("2 hotels");
    const rows = screen.getByTestId("hotels-grid").children;
    expect(rows.map((row) => (typeof row === "string" ? 0 : row.children.length))).toEqual([2]);
  });

  it("keeps the compare picks when the window crosses 1024", async () => {
    mockWindow.width = 768;
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(clientMe(["hotel_discovery", "saved_hotels"]));
      if (url.pathname === "/hotels/saved/ids") return ok({ ids: [] });
      return method === "GET" && url.pathname === "/hotels"
        ? ok(pageOf([PAVILION, HAVELI]))
        : undefined;
    });
    await renderWithApi(<DestinationHotelsScreen destinationId={DEST_ID} />, api.fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    await fireEvent.press(await screen.findByTestId(`compare-select-${PAVILION.id}`));
    await act(() => {
      mockWindow.width = 1440;
      mockWindow.listeners.forEach((listener) => listener());
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeOnTheScreen();
    expect(screen.getByTestId(`compare-select-${PAVILION.id}`)).toBeChecked();
  });
});
