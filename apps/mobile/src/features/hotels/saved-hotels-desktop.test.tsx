import type * as ReactModule from "react";

import { act, fireEvent, screen, waitFor, within } from "../../test/render";
import { SavedHotelsScreen } from "./saved-hotels-screen";
import {
  clientMe,
  fakeApi,
  HOTEL_ID,
  hotelFixture,
  JAIPUR,
  ok,
  pageOf,
  renderWithApi,
  savedFixture,
} from "./hotels.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: mockPush, dismissTo: jest.fn() }),
}));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does, and nothing above them (a rerender from the top would not
 * reach them under the React Compiler, and the layout would never switch).
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

const ENTRY = savedFixture(hotelFixture(), "018f0000-0000-7000-8000-0000000000a1");
const SECOND = savedFixture(
  hotelFixture({
    id: "018f0000-0000-7000-8000-00000000cafe",
    slug: "amber-haveli-jaipur",
    name: "Amber Haveli",
    destination: JAIPUR,
  }),
  "018f0000-0000-7000-8000-0000000000a2",
);
const ROW_NAME = "The Lake Pavilion in Udaipur, Rajasthan, saved 2 Nov 2026";
const REMOVE_NAME = "Remove The Lake Pavilion from your shortlist";

/** Two saved hotels for a client who may still browse (so Compare shows); the first carries a note. */
function twoSavedApi(note: string | null = null) {
  return fakeApi((method, url) => {
    if (url.pathname === "/me") return ok(clientMe(["hotel_discovery", "saved_hotels"]));
    if (method === "GET" && url.pathname === "/hotels/saved")
      return ok(pageOf([{ ...ENTRY, note }, SECOND]));
    if (method === "DELETE" && url.pathname === `/hotels/${HOTEL_ID}/save`)
      return ok({ hotelId: HOTEL_ID });
    return undefined;
  });
}

beforeEach(() => {
  mockWindow.width = 1440;
  mockPush.mockClear();
});

describe("SavedHotelsScreen on a desktop (D7)", () => {
  it("sets the hotels side by side in one glass card, each a column with its facts", async () => {
    await renderWithApi(<SavedHotelsScreen />, twoSavedApi("Great lawn").fetch);
    const grid = await screen.findByTestId("saved-grid");
    const column = within(grid).getByTestId(`saved-card-${HOTEL_ID}`);
    expect(within(column).getByRole("button", { name: ROW_NAME })).toBeOnTheScreen();
    expect(within(column).getByText("Seats 500–900")).toBeOnTheScreen();
    expect(within(column).getByText("84 rooms")).toBeOnTheScreen();
    expect(within(column).getByLabelText("Verified 2 Nov 2026")).toBeOnTheScreen();
    expect(within(column).getByText("Great lawn")).toBeOnTheScreen();
    expect(within(grid).getByTestId(`saved-card-${SECOND.hotel.id}`)).toBeOnTheScreen();
    // The count moves from the card to the title's right, as D7 sets it.
    expect(screen.getByText("2 hotels")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "My selection" })).toBeOnTheScreen();
  });

  it("keeps the note and remove actions on each column, in words", async () => {
    const api = twoSavedApi("Great lawn");
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    const column = within(await screen.findByTestId(`saved-card-${HOTEL_ID}`));
    expect(
      column.getByRole("button", { name: "Edit note for The Lake Pavilion" }),
    ).toBeOnTheScreen();
    expect(column.getByText("Edit note")).toBeOnTheScreen();
    await fireEvent.press(column.getByRole("button", { name: REMOVE_NAME }));
    await waitFor(() => expect(api.calls).toContain(`DELETE /hotels/${HOTEL_ID}/save`));
  });

  it("picks the hotels to compare inside their columns", async () => {
    await renderWithApi(<SavedHotelsScreen />, twoSavedApi("Great lawn").fetch);
    await screen.findByTestId("saved-grid");
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    expect(screen.queryByRole("button", { name: REMOVE_NAME })).toBeNull();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Compare The Lake Pavilion" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Compare Amber Haveli" }));
    await fireEvent.press(screen.getByRole("button", { name: "Compare" }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/compare",
      params: { ids: `${HOTEL_ID},${SECOND.hotel.id}` },
    });
  });
});

describe("SavedHotelsScreen across 1024", () => {
  it.each([
    [390, 1440],
    [1440, 768],
  ])("keeps an open note sheet and its draft from %i to %i", async (from, to) => {
    mockWindow.width = from;
    await renderWithApi(<SavedHotelsScreen />, twoSavedApi().fetch);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Add a note for The Lake Pavilion" }),
    );
    await fireEvent.changeText(await screen.findByLabelText("Your note"), "Great lawn");

    await resizeTo(to);
    // The layout really swapped (rows for columns, or back), yet the sheet and its draft held.
    expect(screen.queryByTestId("saved-grid") === null).toBe(to < 1024);
    expect(screen.getByLabelText("Your note")).toHaveDisplayValue("Great lawn");
    expect(screen.getByText("Note · The Lake Pavilion")).toBeOnTheScreen();
  });

  it.each([
    [390, 1440],
    [1440, 390],
  ])("keeps compare mode and its picks from %i to %i", async (from, to) => {
    mockWindow.width = from;
    await renderWithApi(<SavedHotelsScreen />, twoSavedApi().fetch);
    await screen.findByText("2 hotels");
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    await fireEvent.press(screen.getByTestId(`compare-select-${HOTEL_ID}`));

    await resizeTo(to);
    expect(screen.queryByTestId("saved-grid") === null).toBe(to < 1024);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeOnTheScreen();
    expect(screen.getByTestId(`compare-select-${HOTEL_ID}`)).toBeChecked();
    expect(screen.getByTestId(`compare-select-${SECOND.hotel.id}`)).not.toBeChecked();
    expect(screen.getByText("1 selected")).toBeOnTheScreen();
  });
});
