import type * as ReactModule from "react";

import type { MediaAssetView, VerificationView } from "@ampm/core";

import { act, fireEvent, screen, within } from "../../test/render";
import { HotelRatesScreen } from "./hotel-rates-screen";
import {
  destinationViewFixture,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  mediaAssetFixture,
  ok,
  RATE_CARD_ID,
  rateCardViewFixture,
  renderWithApi,
  routedFetch,
  verificationViewFixture,
} from "./hotels-admin.test-utils";

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

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

interface Data {
  readonly verifications?: VerificationView[];
  readonly media?: MediaAssetView[];
  readonly nextCursor?: string | null;
}

async function renderRates({ verifications = [], media = [], nextCursor = null }: Data = {}) {
  const fetchImpl = routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotelStaffDetailViewFixture()),
    "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards`]: () => ok({ items: [rateCardViewFixture()] }),
    [`/hotels-admin/hotels/${HOTEL_ID}/verifications`]: () => ok({ items: verifications }),
    "/media": () => ok({ items: media, nextCursor }),
  });
  await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, fetchImpl);
  await screen.findByTestId(`rate-card-panel-${RATE_CARD_ID}`);
}

const VIDEO = mediaAssetFixture({
  id: "018f0000-0000-7000-8000-0000000c0a09",
  kind: "video",
  rightsStatus: "owned",
});

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 1440;
});

describe("HotelRatesScreen from 1024 (T5)", () => {
  it("sets the rate cards beside a 288 side column", async () => {
    await renderRates();
    const split = screen.getByTestId("rates-split");
    expect(split.props.className).toContain("flex-row");
    expect(within(split).getByTestId("rates-side")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Rate cards" })).toBeSelected();
  });

  it("says when and how the rates were last verified", async () => {
    await renderRates({
      verifications: [
        verificationViewFixture({ id: "018f0000-0000-7000-8000-0000000c1202", verifiedAt: null }),
        verificationViewFixture({ nextDueAt: "2027-03-01T00:00:00Z" }),
      ],
    });
    const panel = await screen.findByTestId("rates-verification");
    expect(await within(panel).findByText("Verified on 1 Nov 2026")).toBeOnTheScreen();
    expect(within(panel).getByText("Source: Phone")).toBeOnTheScreen();
    expect(within(panel).getByText("Due for checking again on 1 Mar 2027.")).toBeOnTheScreen();
  });

  it("says the rates are not verified yet when no rates verification exists", async () => {
    await renderRates({ verifications: [verificationViewFixture({ fieldGroup: "rooms" })] });
    expect(await screen.findByText("Rates not verified yet")).toBeOnTheScreen();
  });

  it("summarises the media rights, with the consent still owed", async () => {
    await renderRates({ media: [mediaAssetFixture(), VIDEO] });
    const panel = await screen.findByTestId("rates-media-rights");
    expect(within(panel).getByText("Photos · 1")).toBeOnTheScreen();
    expect(within(panel).getByText("1 needs consent")).toBeOnTheScreen();
    expect(within(panel).getByText("Videos · 1")).toBeOnTheScreen();
    expect(within(panel).getByText("Cleared")).toBeOnTheScreen();
  });

  it("leaves the media rights out when there is no media, or only a first page of it", async () => {
    await renderRates({
      media: [mediaAssetFixture()],
      nextCursor: "018f0000-0000-7000-8000-0000000c0a01",
    });
    expect(await screen.findByTestId("rates-verification")).toBeOnTheScreen();
    expect(screen.queryByTestId("rates-media-rights")).toBeNull();
  });

  it("keeps a rate card being written when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderRates();
    await fireEvent.press(screen.getByTestId("rate-card-add"));
    await fireEvent.changeText(await screen.findByTestId("rate-card-name"), "Winter 2026–27");
    await resizeTo(1440);
    expect(screen.getByTestId("rates-split").props.className).toContain("flex-row");
    expect(screen.getByTestId("rate-card-name")).toHaveDisplayValue("Winter 2026–27");
    await resizeTo(390);
    expect(screen.getByTestId("rate-card-name")).toHaveDisplayValue("Winter 2026–27");
  });

  it("keeps a rate item being written when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderRates();
    await fireEvent.press(screen.getByTestId(`rate-card-${RATE_CARD_ID}-add-item`));
    await fireEvent.changeText(await screen.findByTestId("rate-item-inclusions"), "Breakfast");
    await resizeTo(1440);
    expect(screen.getByTestId("rate-item-inclusions")).toHaveDisplayValue("Breakfast");
    await resizeTo(390);
    expect(screen.getByTestId("rate-item-inclusions")).toHaveDisplayValue("Breakfast");
  });
});
