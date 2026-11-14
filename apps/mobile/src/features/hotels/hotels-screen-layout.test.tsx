import type * as ReactModule from "react";
import type { HotelView } from "@ampm/core";

import { act, fireEvent, screen, waitFor, within } from "../../test/render";
import { HotelsScreen } from "./hotels-screen";
import {
  clientMe,
  fakeApi,
  hotelFixture,
  JAIPUR,
  ok,
  pageOf,
  pendingFetch,
  renderWithApi,
} from "./hotels.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn() }),
}));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does, and nothing above them.
 */
const mockWindow = { width: 1440, listeners: new Set<() => void>() };
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

/** Resizes the window, telling every component that reads it. */
async function resizeTo(width: number) {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const PAVILION = hotelFixture();
const HAVELI = hotelFixture({
  id: "018f0000-0000-7000-8000-00000000cafe",
  slug: "amber-haveli-jaipur",
  name: "Amber Haveli",
  destination: JAIPUR,
});
const FORT = hotelFixture({
  id: "018f0000-0000-7000-8000-00000000f047",
  slug: "amber-fort-jaipur",
  name: "Amber Fort",
  destination: JAIPUR,
});

/** `/me` for a subscriber with a shortlist, and these hotels on `GET /hotels`. */
function catalogue(hotels: readonly HotelView[]) {
  return fakeApi((method, url) => {
    if (url.pathname === "/me") return ok(clientMe(["hotel_discovery", "saved_hotels"]));
    if (url.pathname === "/hotels/saved/ids") return ok({ ids: [] });
    return method === "GET" && url.pathname === "/hotels" ? ok(pageOf(hotels)) : undefined;
  });
}

/** How many cells each of the result grid's rows holds. */
function gridRows(): number[] {
  return screen
    .getByTestId("hotels-grid")
    .children.map((row) => (typeof row === "string" ? 0 : row.children.length));
}

const classOf = (element: { props: { className?: unknown } } | null | undefined) =>
  String(element?.props.className ?? "");

beforeEach(() => {
  mockWindow.width = 1440;
});

describe("HotelsScreen from 1024 (D5)", () => {
  it("holds the name search and the three selects in one glass pill", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    await screen.findByText("2 hotels");
    const pill = within(screen.getByTestId("hotel-search-pill"));
    expect(pill.getByLabelText("Search hotels")).toBeOnTheScreen();
    expect(pill.getByTestId("hotel-filter-star")).toBeOnTheScreen();
    expect(pill.getByTestId("hotel-filter-capacity")).toBeOnTheScreen();
    expect(pill.getByTestId("hotel-filter-rooms")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
  });

  it("puts the chips, the count and the compare toggle on one row", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    const toolbar = within(await screen.findByTestId("hotels-toolbar"));
    expect(toolbar.getByRole("button", { name: "Verified rates only" })).toBeOnTheScreen();
    expect(toolbar.getByRole("button", { name: "Jaipur" })).toBeOnTheScreen();
    expect(toolbar.getByText("2 hotels")).toBeOnTheScreen();
    expect(toolbar.getByRole("button", { name: "Compare" })).toBeOnTheScreen();
  });

  it("shows the results two per row, the last row padded", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI, FORT]).fetch);
    await screen.findByText("3 hotels");
    expect(gridRows()).toEqual([2, 2]);
    // The card fills its cell, so two side by side are as tall as each other.
    const card = screen.getByRole("button", { name: /The Lake Pavilion in Udaipur/ });
    expect(classOf(card)).toContain("grow");
  });

  it("keeps the heading for screen readers at a lighter size", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION]).fetch);
    expect(classOf(await screen.findByRole("header", { name: "Hotels" }))).toContain("lg:text-3xl");
  });

  it("lays the loading skeletons two per row, as the cards will be", async () => {
    await renderWithApi(<HotelsScreen />, pendingFetch);
    const rows = screen.getByTestId("hotels-loading").children;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => (typeof row === "string" ? 0 : row.children.length))).toEqual([2, 2]);
  });
});

describe("HotelsScreen below 1024", () => {
  it("keeps one card per row and today's filter rows from 768", async () => {
    mockWindow.width = 768;
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    await screen.findByText("2 hotels");
    expect(gridRows()).toEqual([1, 1]);
    expect(screen.getByTestId("hotel-filter-star")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotels-toolbar")).toBeNull();
  });

  it("puts the Filters pill, verified rates and the destinations on one chip row on a phone", async () => {
    mockWindow.width = 390;
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    await screen.findByText("2 hotels");
    const row = within(screen.getByLabelText("Search filters"));
    expect(row.getByRole("button", { name: "Filters" })).toBeOnTheScreen();
    expect(row.getByRole("button", { name: "Verified rates only" })).toBeOnTheScreen();
    expect(row.getByRole("button", { name: "Jaipur" })).toBeOnTheScreen();
    expect(gridRows()).toEqual([1, 1]);
  });

  it("counts the sheet's filters on the phone's Filters pill", async () => {
    mockWindow.width = 390;
    const api = catalogue([PAVILION]);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByText("1 hotel");
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(await screen.findByTestId("hotel-filter-star-option-5"));
    await waitFor(() => expect(api.calls).toContain("GET /hotels?star=5&limit=50"));
    expect(screen.getByRole("button", { name: "Filters, 1" })).toBeOnTheScreen();
  });
});

describe("HotelsScreen across 1024", () => {
  it.each([
    [768, 1440],
    [1440, 390],
  ])("keeps the compare picks when the window goes from %i to %i", async (from, to) => {
    mockWindow.width = from;
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    await fireEvent.press(await screen.findByTestId(`compare-select-${PAVILION.id}`));
    expect(screen.getByTestId(`compare-select-${PAVILION.id}`)).toBeChecked();

    await resizeTo(to);
    // The arrangement changed around the results, which were not rebuilt: still comparing, pick held.
    expect(screen.queryByTestId("hotels-toolbar") === null).toBe(to < 1024);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeOnTheScreen();
    expect(screen.getByTestId(`compare-select-${PAVILION.id}`)).toBeChecked();
    expect(screen.getByTestId(`compare-select-${HAVELI.id}`)).not.toBeChecked();
  });
});
