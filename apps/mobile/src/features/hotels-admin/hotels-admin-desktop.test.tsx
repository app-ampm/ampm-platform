import type * as ReactModule from "react";

import type { HotelImportResult } from "@ampm/core";

import { act, fireEvent, screen, within } from "../../test/render";
import { HotelImportScreen } from "./hotel-import-screen";
import { HotelsListScreen } from "./hotels-list-screen";
import { pickCsvFile } from "./pick-csv-file";
import {
  destinationViewFixture,
  hotelStaffViewFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does (a plain width mock lets React Compiler skip the render).
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

/** Resizes the window, telling every component that reads it (a tablet turning, a window resized). */
async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const hotelsFetch: FetchFn = routedFetch({
  "/hotels-admin/hotels": () =>
    ok({
      items: [
        hotelStaffViewFixture({ lastVerifiedAt: "2026-11-02T06:30:00.000Z", publicShowcase: true }),
      ],
      nextCursor: null,
    }),
  "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
});

const RESULT: HotelImportResult = {
  importJobId: "018f0000-0000-7000-8000-00000000f001",
  dryRun: true,
  applied: false,
  totalRows: 1,
  created: 0,
  updated: 0,
  destinationsCreated: 0,
  mediaRegistered: 0,
  rejected: [],
};
const importFetch: FetchFn = routedFetch({ "/hotels-admin/imports": () => ok(RESULT) });
const CSV = "destinationSlug,name\nudaipur,Taj Lake Palace";

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 1440;
});

describe("HotelsListScreen across 1024 (T4)", () => {
  it("adds T4's verification and visibility columns from 1024, and keeps three below it", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch);
    expect(await screen.findByText("Last verified")).toBeOnTheScreen();
    expect(screen.getByText("2 NOV 2026")).toBeOnTheScreen();
    expect(screen.getByText("Public")).toBeOnTheScreen();
    expect(screen.getByText("Yes")).toBeOnTheScreen();
    expect(screen.getByText("Demo")).toBeOnTheScreen();
    expect(screen.getByText("No")).toBeOnTheScreen();
    await resizeTo(390);
    expect(screen.queryByText("Last verified")).toBeNull();
    expect(screen.queryByText("Public")).toBeNull();
    expect(screen.getByText("Rooms")).toBeOnTheScreen();
  });

  it("sets Import and New hotel in the header's actions, which wrap on a phone", async () => {
    mockWindow.width = 390;
    await renderWithApi(<HotelsListScreen />, hotelsFetch);
    // The header's actions slot is the nearest box around the button that wraps its children.
    let actions = (await screen.findByTestId("hotel-new")).parent;
    while (actions && !String(actions.props.className ?? "").includes("flex-wrap")) {
      actions = actions.parent;
    }
    // ScreenHeader's actions slot: it wraps under the title on a phone and gives way beside it from 768.
    expect(actions?.props.className).toContain("md:justify-end");
    expect(within(actions!).getByTestId("hotel-import-link")).toBeOnTheScreen();
  });

  it("keeps a new hotel being typed when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderWithApi(<HotelsListScreen />, hotelsFetch);
    await fireEvent.press(await screen.findByTestId("hotel-new"));
    await fireEvent.changeText(await screen.findByTestId("hotel-brand"), "Taj Hotels");
    await resizeTo(1440);
    expect(await screen.findByText("Last verified")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-brand")).toHaveDisplayValue("Taj Hotels");
    await resizeTo(390);
    expect(screen.getByTestId("hotel-brand")).toHaveDisplayValue("Taj Hotels");
  });
});

describe("HotelImportScreen across 1024", () => {
  it("keeps a chosen CSV and its file name when the window crosses 1024, the hint moving aside", async () => {
    mockWindow.width = 390;
    jest.mocked(pickCsvFile).mockResolvedValue({ content: CSV, name: "hotels.csv" });
    await renderWithApi(<HotelImportScreen />, importFetch);
    const hintIn = (column: string) =>
      within(screen.getByTestId(`hotel-import-${column}`)).queryByTestId("hotel-import-columns");
    expect(hintIn("main")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("hotel-import-choose"));
    expect(await screen.findByText("hotels.csv")).toBeOnTheScreen();
    await resizeTo(1440);
    expect(screen.getByTestId("hotel-import-split").props.className).toContain("flex-row");
    expect(hintIn("side")).toBeOnTheScreen();
    expect(hintIn("main")).toBeNull();
    expect(screen.getByTestId("hotel-import-content")).toHaveDisplayValue(CSV);
    expect(screen.getByText("hotels.csv")).toBeOnTheScreen();
    await resizeTo(390);
    expect(hintIn("main")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-content")).toHaveDisplayValue(CSV);
    expect(screen.getByText("hotels.csv")).toBeOnTheScreen();
  });

  it("shows the validation result in the side column, beside a taller CSV box", async () => {
    await renderWithApi(<HotelImportScreen />, importFetch);
    expect(screen.getByTestId("hotel-import-content").props.numberOfLines).toBe(14);
    await fireEvent.changeText(screen.getByTestId("hotel-import-content"), CSV);
    await fireEvent.press(screen.getByTestId("hotel-import-validate"));
    const side = screen.getByTestId("hotel-import-side");
    expect(await within(side).findByTestId("hotel-import-result")).toBeOnTheScreen();
    await resizeTo(390);
    expect(screen.getByTestId("hotel-import-content").props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId("hotel-import-result")).toBeOnTheScreen();
  });
});
