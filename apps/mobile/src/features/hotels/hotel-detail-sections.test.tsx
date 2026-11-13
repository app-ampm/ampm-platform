import type {
  ClientRateItemView,
  HotelDetailView,
  HotelRoomClientView,
  HotelVenueClientView,
  MediaGalleryItem,
  WeddingReferenceClientItem,
} from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { HotelDetailScreen } from "./hotel-detail-screen";
import { detailFixture, fakeApi, HOTEL_ID, ok, renderWithApi } from "./hotels.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

const AS_OF = "2026-11-02T06:30:00.000Z";

const ROOM: ClientRateItemView = {
  itemType: "room_rate",
  amount: { minor: 1800000, currency: "INR" },
  amountMax: { minor: 2400000, currency: "INR" },
  unit: "per_night",
  inclusions: "Breakfast for two",
};

const VEG_PLATE: ClientRateItemView = {
  itemType: "per_plate_veg",
  amount: { minor: 320000, currency: "INR" },
  amountMax: { minor: 380000, currency: "INR" },
  unit: "per_plate",
  inclusions: null,
};

const TAX: ClientRateItemView = {
  itemType: "tax",
  amount: { minor: 1800, currency: "INR" },
  amountMax: null,
  unit: "percent",
  inclusions: null,
};

const REFERENCE: WeddingReferenceClientItem = {
  id: "018f0000-0000-7000-8000-0000000000e1",
  eventYear: 2025,
  guestCount: 320,
  descriptionClient: "A three-day lakeside wedding.",
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
  facilities: ["Stage", "Dance floor", "Air conditioning"],
  description: "A pillarless hall overlooking the lake.",
};

const ROOM_CATEGORY: HotelRoomClientView = {
  id: "018f0000-0000-7000-8000-000000000b01",
  name: "Lake-View Suite",
  roomCount: 24,
  maxOccupancy: 3,
  sizeSqm: 65,
  facilities: ["Balcony", "Mini-bar"],
  description: "Corner suites facing Lake Pichola.",
};

function rates(status: "verified" | "stale"): HotelDetailView["rates"] {
  return { status, asOf: AS_OF, items: [ROOM, VEG_PLATE, TAX] };
}

async function renderDetail(detail: HotelDetailView): Promise<void> {
  const api = fakeApi((method, url) =>
    method === "GET" && url.pathname === `/hotels/${HOTEL_ID}` ? ok(detail) : undefined,
  );
  await renderWithApi(<HotelDetailScreen hotelId={HOTEL_ID} />, api.fetch);
  await screen.findByText(detail.name);
}

async function openTab(name: RegExp | string): Promise<void> {
  await fireEvent.press(screen.getByRole("tab", { name }));
}

describe("HotelDetailScreen sections", () => {
  it("marks verified rates peacock with the date, and lists each amount as a range", async () => {
    await renderDetail(detailFixture({ rates: rates("verified") }));
    await openTab("Rates");
    const chip = screen.getByLabelText("Verified on 2 Nov 2026 by AMPM");
    expect(String(chip.props.className)).toContain("bg-success");
    expect(screen.getByText("Per plate, veg")).toBeOnTheScreen();
    expect(screen.getByText("₹3,200–3,800")).toBeOnTheScreen();
    expect(screen.getByText("per night · Breakfast for two")).toBeOnTheScreen();
    expect(screen.getByText("18%")).toBeOnTheScreen();
    // B18: the items are grouped — accommodation and venue, then food and beverage, then charges —
    // each label a heading so assistive tech can jump between the categories.
    expect(screen.getByRole("header", { name: "Rooms & venues" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Food & beverage" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Charges & taxes" })).toBeOnTheScreen();
    expect(screen.getByText(/^Indicative ranges, not a quote\./)).toBeOnTheScreen();
  });

  it("puts the room rate in the sticky footer as the headline price", async () => {
    await renderDetail(detailFixture({ rates: rates("verified") }));
    // The overview is open, so the only amount on screen is the footer's.
    expect(screen.getByText("₹18,000–24,000")).toBeOnTheScreen();
    expect(screen.getByText("per room / night")).toBeOnTheScreen();
  });

  it("labels stale rates with the neutral chip and still shows their amounts", async () => {
    await renderDetail(detailFixture({ rates: rates("stale") }));
    expect(screen.getByText("Stale · per room / night")).toBeOnTheScreen();
    await openTab("Rates");
    const chip = screen.getByLabelText("Stale · checked 2 Nov 2026");
    expect(String(chip.props.className)).toContain("bg-primary/8");
    expect(screen.getAllByText("₹18,000–24,000")).toHaveLength(2);
  });

  it("adds a gallery tab for the pictures and leads the page with the first", async () => {
    const picture: MediaGalleryItem = {
      id: "018f0000-0000-7000-8000-0000000000f1",
      kind: "image",
      caption: "Lakeside lawn at dusk",
      thumbnailUrl: "https://media.test/thumb.jpg",
      webUrl: "https://media.test/web.jpg",
    };
    await renderDetail(detailFixture({ gallery: [picture] }));
    // The hero shows the picture itself; the stand-in is gone.
    expect(screen.getByLabelText("Lakeside lawn at dusk")).toBeOnTheScreen();
    expect(screen.queryByRole("image", { name: "Hotel photo · Udaipur" })).toBeNull();
    await openTab("Gallery, 1");
    expect(screen.getByRole("tab", { name: "Gallery, 1" })).toBeSelected();
    expect(screen.getAllByLabelText("Lakeside lawn at dusk")).toHaveLength(2);
  });

  it("adds the previous weddings shown with the family's consent", async () => {
    await renderDetail(detailFixture({ references: [REFERENCE] }));
    await openTab("Weddings, 1");
    expect(screen.getByText("Wedding in 2025")).toBeOnTheScreen();
    expect(screen.getByText("A three-day lakeside wedding.")).toBeOnTheScreen();
    expect(screen.getByText("320 guests")).toBeOnTheScreen();
  });

  it("opens on the rates when the hotel has no overview to show", async () => {
    await renderDetail(
      detailFixture({ description: null, address: null, references: [REFERENCE] }),
    );
    expect(screen.queryByRole("tab", { name: "Overview" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Rates" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Weddings, 1" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Rates on request")).toBeOnTheScreen();
  });

  it("drops the tab strip when the rates are the only section", async () => {
    await renderDetail(detailFixture({ description: null, address: null }));
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByLabelText("Rates on request")).toBeOnTheScreen();
  });

  it("lists the venues with their kind, capacities and amenities", async () => {
    await renderDetail(detailFixture({ venues: [VENUE] }));
    await openTab("Venues, 1");
    expect(screen.getByRole("tab", { name: "Venues, 1" })).toBeSelected();
    expect(screen.getByText("The Durbar Ballroom")).toBeOnTheScreen();
    expect(screen.getByText("Ballroom · Indoor")).toBeOnTheScreen();
    expect(
      screen.getByText("Banquet 500 · Reception 900 · Theatre 700 · 1200 m²"),
    ).toBeOnTheScreen();
    expect(screen.getByText("A pillarless hall overlooking the lake.")).toBeOnTheScreen();
    expect(screen.getByText("Stage · Dance floor · Air conditioning")).toBeOnTheScreen();
  });

  it("lists the room categories with their size and occupancy", async () => {
    await renderDetail(detailFixture({ rooms: [ROOM_CATEGORY] }));
    await openTab("Rooms, 1");
    expect(screen.getByRole("tab", { name: "Rooms, 1" })).toBeSelected();
    expect(screen.getByText("Lake-View Suite")).toBeOnTheScreen();
    expect(screen.getByText("24 rooms · Sleeps 3 · 65 m²")).toBeOnTheScreen();
    expect(screen.getByText("Corner suites facing Lake Pichola.")).toBeOnTheScreen();
    expect(screen.getByText("Balcony · Mini-bar")).toBeOnTheScreen();
  });

  it("shows the hotel's facilities as chips on the overview", async () => {
    await renderDetail(detailFixture({ facilities: ["Spa", "Valet parking", "Late licence"] }));
    expect(screen.getByText("Facilities")).toBeOnTheScreen();
    expect(screen.getByText("Spa")).toBeOnTheScreen();
    expect(screen.getByText("Valet parking")).toBeOnTheScreen();
    expect(screen.getByText("Late licence")).toBeOnTheScreen();
  });
});
