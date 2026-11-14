import type * as ReactModule from "react";

import type { MediaAssetView } from "@ampm/core";

import { act, fireEvent, screen, within } from "../../test/render";
import { HotelMediaScreen } from "./hotel-media-screen";
import {
  destinationViewFixture,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  mediaAssetFixture,
  ok,
  renderWithApi,
  routedFetch,
} from "./hotels-admin.test-utils";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("./pick-media-file", () => ({ pickMediaFile: jest.fn() }));

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

async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const idOf = (n: number) => `018f0000-0000-7000-8000-0000000c0a0${n}`;
const FOUR: MediaAssetView[] = [1, 2, 3, 4].map((n) =>
  mediaAssetFixture({ id: idOf(n), caption: `Photo ${n}`, scanStatus: "pending" }),
);

async function renderManager(items: MediaAssetView[] = FOUR): Promise<void> {
  const fetchImpl = routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotelStaffDetailViewFixture()),
    "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
    "/media": () => ok({ items, nextCursor: null }),
  });
  await renderWithApi(<HotelMediaScreen hotelId={HOTEL_ID} />, fetchImpl);
}

/** The grid's rows: the cells come in rows of the column count, padded at the end. */
const gridRows = (): number => {
  const rows: unknown = screen.getByTestId("media-grid").props.children;
  return Array.isArray(rows) ? rows.length : 0;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 1440;
});

describe("HotelMediaScreen across 768 and 1024", () => {
  it("tiles the media four across from 1024, three from 768, and keeps rows on a phone", async () => {
    await renderManager();
    expect(await screen.findByTestId(`media-tile-${idOf(1)}`)).toBeOnTheScreen();
    expect(gridRows()).toBe(1);
    await resizeTo(768);
    expect(gridRows()).toBe(2);
    await resizeTo(390);
    expect(screen.queryByTestId("media-grid")).toBeNull();
    expect(screen.getByTestId(`media-row-${idOf(1)}`)).toBeOnTheScreen();
  });

  it("gives each tile the photo's name, chips, and its own edit and delete", async () => {
    await renderManager();
    const tile = await screen.findByTestId(`media-tile-${idOf(2)}`);
    expect(within(tile).getByText("Photo 2")).toBeOnTheScreen();
    expect(within(tile).getByText("Scanning")).toBeOnTheScreen();
    expect(within(tile).getByRole("button", { name: "Edit Photo 2" })).toBeOnTheScreen();
    expect(within(tile).getByRole("button", { name: "Delete Photo 2" })).toBeOnTheScreen();
  });

  it("sits under the hotel's record header, with Media the selected tab", async () => {
    await renderManager();
    expect(await screen.findByRole("header", { name: "The Lakeside Palace" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Media" })).toBeSelected();
    expect(screen.queryByTestId("hotel-details-link")).toBeNull();
    expect(screen.queryByTestId("hotel-rates-link")).toBeNull();
  });

  it("keeps a caption being edited when the window crosses 768 and 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderManager();
    await fireEvent.press(await screen.findByTestId(`media-edit-${idOf(1)}`));
    await fireEvent.changeText(await screen.findByTestId("media-caption"), "Lobby at night");
    await resizeTo(1440);
    expect(screen.getByTestId(`media-tile-${idOf(1)}`)).toBeOnTheScreen();
    expect(screen.getByTestId("media-caption")).toHaveDisplayValue("Lobby at night");
    await resizeTo(390);
    expect(screen.getByTestId(`media-row-${idOf(1)}`)).toBeOnTheScreen();
    expect(screen.getByTestId("media-caption")).toHaveDisplayValue("Lobby at night");
  });

  it("keeps the profile being edited when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderManager();
    await fireEvent.press(await screen.findByTestId("hotel-edit-profile"));
    await fireEvent.changeText(await screen.findByTestId("hotel-brand"), "Taj Hotels");
    await resizeTo(1440);
    expect(screen.getByTestId("media-grid")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-brand")).toHaveDisplayValue("Taj Hotels");
    await resizeTo(390);
    expect(screen.getByTestId("hotel-brand")).toHaveDisplayValue("Taj Hotels");
  });
});
