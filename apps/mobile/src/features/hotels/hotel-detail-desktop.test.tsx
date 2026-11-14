import type {
  ClientRateItemView,
  EntitlementModule,
  HotelDetailView,
  HotelVenueClientView,
  MediaGalleryItem,
} from "@ampm/core";
import { ApiProvider } from "@ampm/api-client";

import { TEST_API_BASE } from "../../test/api";
import { fireEvent, screen, within } from "../../test/render";
import { HotelDetailScreen } from "./hotel-detail-screen";
import {
  clientMe,
  detailFixture,
  fakeApi,
  HOTEL_ID,
  ok,
  renderWithApi,
  savedIds,
} from "./hotels.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: mockPush }),
}));

// The window's width picks the page: P4 below 1024, D6's composition from there.
const mockWindow = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const ROOM: ClientRateItemView = {
  itemType: "room_rate",
  amount: { minor: 1800000, currency: "INR" },
  amountMax: { minor: 2400000, currency: "INR" },
  unit: "per_night",
  inclusions: null,
};

const VENUE: HotelVenueClientView = {
  id: "018f0000-0000-7000-8000-000000000a01",
  name: "The Durbar Ballroom",
  venueType: "ballroom",
  isIndoor: true,
  areaSqm: 1200,
  capacityBanquet: 500,
  capacityTheatre: 700,
  capacityReception: 900,
  facilities: null,
  description: null,
};

const PICTURE: MediaGalleryItem = {
  id: "018f0000-0000-7000-8000-0000000000f1",
  kind: "image",
  caption: "Lakeside lawn at dusk",
  thumbnailUrl: "https://media.test/thumb.jpg",
  webUrl: "https://media.test/web.jpg",
};

const HOTEL = detailFixture({
  rates: { status: "verified", asOf: "2026-11-02T06:30:00.000Z", items: [ROOM] },
  venues: [VENUE],
  facilities: ["Spa", "Valet parking"],
});

/** A subscriber who may save and ask, with this hotel and another on the shortlist. */
const SUBSCRIBER: readonly EntitlementModule[] = [
  "hotel_discovery",
  "saved_hotels",
  "hotel_assistance",
];

interface Account {
  readonly modules?: readonly EntitlementModule[];
  readonly shortlist?: readonly string[];
}

async function renderDesktop(hotel: HotelDetailView, account: Account = {}) {
  const { modules = SUBSCRIBER, shortlist = [HOTEL_ID, "018f0000-0000-7000-8000-0000000000b2"] } =
    account;
  const api = fakeApi((_method, url) => {
    if (url.pathname === `/hotels/${HOTEL_ID}`) return ok(hotel);
    if (url.pathname === "/hotels/saved/ids") return ok(savedIds(shortlist));
    if (url.pathname === "/me") return ok(clientMe(modules));
    return undefined;
  });
  const queryClient = await renderWithApi(<HotelDetailScreen hotelId={HOTEL_ID} />, api.fetch);
  await screen.findByRole("header", { name: hotel.name });
  /** Renders the screen again in a window this wide, as a tablet turning or a window resizing does. */
  return async (width: number) => {
    mockWindow.width = width;
    await screen.rerender(
      <ApiProvider baseUrl={TEST_API_BASE} fetch={api.fetch} queryClient={queryClient}>
        <HotelDetailScreen hotelId={HOTEL_ID} />
      </ApiProvider>,
    );
  };
}

beforeEach(() => {
  mockWindow.width = 1440;
  mockPush.mockClear();
});

describe("HotelDetailScreen on a desktop (D6)", () => {
  it("lays the mosaic across the page and titles the hotel on the background at page-title size", async () => {
    await renderDesktop(HOTEL);
    expect(String(screen.getByTestId("hotel-mosaic").props.className)).toContain("flex-row");
    const title = screen.getByRole("header", { name: "The Lake Pavilion" });
    expect(String(title.props.className)).toContain("text-6xl");
    const block = within(screen.getByTestId("hotel-title-block"));
    expect(block.getByText("Udaipur, Rajasthan")).toBeOnTheScreen();
    expect(block.getByLabelText("1 venue")).toBeOnTheScreen();
    expect(block.getByLabelText("Seats 500–900")).toBeOnTheScreen();
  });

  it("puts the open tab beside the rates, location and facilities at 1.6 : 1, with no sticky bar", async () => {
    await renderDesktop(HOTEL);
    const columns = screen.getByTestId("hotel-detail-columns");
    expect(String(columns.props.className)).toContain("flex-row");
    // Each column's share sits on the cell `Columns` wraps it in.
    expect(screen.getByTestId("hotel-detail-main").parent?.props.style).toMatchObject({
      flexGrow: 1.6,
    });
    expect(screen.getByTestId("hotel-detail-side").parent?.props.style).toMatchObject({
      flexGrow: 1,
    });
    const rates = within(screen.getByTestId("hotel-side-rates"));
    expect(rates.getByLabelText("Verified on 2 Nov 2026 by AMPM")).toBeOnTheScreen();
    expect(rates.getByText("₹18,000–24,000")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-side-location")).toBeOnTheScreen();
    expect(within(screen.getByTestId("hotel-side-facilities")).getByText("Spa")).toBeOnTheScreen();
    // The footer's headline price is the phone's; the desktop has the rates card instead.
    expect(screen.queryByText("per room / night")).toBeNull();
  });

  it("offers no rates tab, and opens on an overview of the description and the venue table", async () => {
    await renderDesktop(HOTEL);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeSelected();
    expect(screen.queryByRole("tab", { name: "Rates" })).toBeNull();
    expect(screen.getByTestId("hotel-section-overview")).toBeOnTheScreen();
    const table = within(screen.getByTestId("hotel-venue-table"));
    expect(table.getByText("Capacity")).toBeOnTheScreen();
    expect(table.getByText("The Durbar Ballroom")).toBeOnTheScreen();
    expect(table.getByText("Ballroom · Indoor")).toBeOnTheScreen();
    expect(table.getByText("Reception 900")).toBeOnTheScreen();
    expect(table.getByText("1200 m²")).toBeOnTheScreen();
  });

  it("shows only the picked section in the main column", async () => {
    await renderDesktop(HOTEL);
    await fireEvent.press(screen.getByRole("tab", { name: "Venues, 1" }));
    expect(screen.getByTestId("hotel-section-venues")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-section-overview")).toBeNull();
    expect(screen.getByTestId("hotel-side-rates")).toBeOnTheScreen();
  });

  it("opens the gallery from the mosaic's photo count", async () => {
    await renderDesktop(
      detailFixture({
        gallery: [PICTURE, { ...PICTURE, id: "018f0000-0000-7000-8000-0000000000f2" }],
      }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "All 2 photos" }));
    expect(screen.getByRole("tab", { name: "Gallery, 2" })).toBeSelected();
  });

  it("keeps D6's actions at the title's right, with the availability check the one gold action", async () => {
    await renderDesktop(HOTEL);
    const saved = await screen.findByRole("button", { name: "Saved to shortlist" });
    expect(String(saved.props.className)).toContain("bg-highlight");
    const check = screen.getByRole("button", { name: "Check availability" });
    expect(String(check.props.className)).toContain("bg-brand");
    await fireEvent.press(screen.getByRole("button", { name: "Compare on your shortlist" }));
    expect(mockPush).toHaveBeenCalledWith("/hotels/saved");
  });

  it("shows an unsaved hotel's save in pearl outline and no compare until it is on the shortlist", async () => {
    await renderDesktop(HOTEL, { shortlist: [] });
    const save = await screen.findByRole("button", { name: "Save hotel" });
    expect(String(save.props.className)).toContain("border-primary/40");
    expect(screen.queryByRole("button", { name: "Compare on your shortlist" })).toBeNull();
  });

  it("makes the save the gold action for an account that may not ask", async () => {
    await renderDesktop(HOTEL, { modules: ["hotel_discovery", "saved_hotels"], shortlist: [] });
    const save = await screen.findByRole("button", { name: "Save hotel" });
    expect(String(save.props.className)).toContain("bg-brand");
    expect(screen.queryByRole("button", { name: "Check availability" })).toBeNull();
  });

  it("keeps the picked tab when the window crosses 1024 either way", async () => {
    mockWindow.width = 768;
    const resizeTo = await renderDesktop(HOTEL);
    await fireEvent.press(screen.getByRole("tab", { name: "Venues, 1" }));
    await resizeTo(1440);
    expect(screen.getByTestId("hotel-mosaic")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Venues, 1" })).toBeSelected();
    expect(screen.getByTestId("hotel-section-venues")).toBeOnTheScreen();
    await resizeTo(768);
    expect(screen.queryByTestId("hotel-mosaic")).toBeNull();
    expect(screen.getByRole("tab", { name: "Venues, 1" })).toBeSelected();
  });

  it("opens the overview beside the rates for a phone's Rates tab, and Rates again on the phone", async () => {
    mockWindow.width = 768;
    const resizeTo = await renderDesktop(HOTEL);
    await fireEvent.press(screen.getByRole("tab", { name: "Rates" }));
    await resizeTo(1440);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeSelected();
    expect(screen.getByTestId("hotel-side-rates")).toBeOnTheScreen();
    await resizeTo(768);
    expect(screen.getByRole("tab", { name: "Rates" })).toBeSelected();
  });

  it("keeps the phone's page, with its sticky price, below 1024", async () => {
    mockWindow.width = 768;
    await renderDesktop(HOTEL);
    expect(screen.queryByTestId("hotel-mosaic")).toBeNull();
    expect(screen.getByText("per room / night")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Rates" })).toBeOnTheScreen();
  });
});
