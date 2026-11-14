import type { HotelCompareItem, SavedHotelView } from "@ampm/core";

import { fireEvent, screen, waitFor } from "../../test/render";
import { CompareScreen } from "./compare-screen";
import {
  COVER_URL,
  fakeApi,
  hotelFixture,
  JAIPUR,
  ok,
  pageOf,
  renderWithApi,
  savedFixture,
} from "./hotels.test-utils";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const PAVILION: HotelCompareItem = {
  ...hotelFixture(),
  rates: {
    status: "verified",
    asOf: "2026-11-02T06:30:00.000Z",
    items: [
      {
        itemType: "room_rate",
        amount: { minor: 1800000, currency: "INR" },
        amountMax: { minor: 2400000, currency: "INR" },
        unit: "per_night",
        inclusions: null,
      },
    ],
  },
};

const HAVELI: HotelCompareItem = {
  ...hotelFixture({
    id: "018f0000-0000-7000-8000-00000000cafe",
    slug: "amber-haveli-jaipur",
    name: "Amber Haveli",
    starCategory: "4",
    destination: JAIPUR,
    totalRooms: 52,
  }),
  rates: { status: "on_request", asOf: null, items: [] },
};

/** The compare answer, and the shortlist the headings borrow their covers from (empty by default). */
function compareApi(
  items: readonly HotelCompareItem[],
  saved: { readonly items: readonly SavedHotelView[]; readonly nextCursor: string | null } = pageOf(
    [],
  ),
) {
  return fakeApi((method, url) => {
    if (method !== "GET") return undefined;
    if (url.pathname === "/hotels/compare") return ok({ items });
    return url.pathname === "/hotels/saved" ? ok(saved) : undefined;
  });
}

beforeEach(() => {
  mockBack.mockClear();
  mockWindow.width = 390;
});

describe("CompareScreen", () => {
  it("lays the saved hotels out side by side, each cell naming its hotel and field", async () => {
    const api = compareApi([PAVILION, HAVELI]);
    await renderWithApi(<CompareScreen ids={[PAVILION.id, HAVELI.id]} />, api.fetch);
    // Each cell is one screen-reader node tying the value to its hotel + field (the visual alignment is not).
    expect(await screen.findByLabelText("The Lake Pavilion, 5-star")).toBeOnTheScreen();
    expect(screen.getByLabelText("Amber Haveli, 4-star")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("The Lake Pavilion, Destination: Udaipur, Rajasthan"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("The Lake Pavilion, Capacity: Seats 500–900")).toBeOnTheScreen();
    expect(screen.getByLabelText("Amber Haveli, Rooms: 52 rooms")).toBeOnTheScreen();
    expect(
      screen.getByLabelText("The Lake Pavilion, Room rate: ₹18,000–₹24,000 per night"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Amber Haveli, Room rate: On request")).toBeOnTheScreen();
    // The chip is D7's short form; the cell speaks the detail's full sentence (AC-04).
    expect(
      screen.getByLabelText("The Lake Pavilion, Rates: Verified on 2 Nov 2026 by AMPM"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Amber Haveli, Rates: Rates on request")).toBeOnTheScreen();
    expect(
      screen.getByText("Verified 2 Nov 2026", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(api.calls.some((call) => call.startsWith("GET /hotels/compare"))).toBe(true),
    );
  });

  it("titles the page as D7 does, counting the hotels compared", async () => {
    await renderWithApi(
      <CompareScreen ids={[PAVILION.id, HAVELI.id]} />,
      compareApi([PAVILION, HAVELI]).fetch,
    );
    expect(screen.getByRole("header", { name: "Side by side" })).toBeOnTheScreen();
    expect(await screen.findByText("My selection · 2 hotels")).toBeOnTheScreen();
  });

  it("adds a row per rate type a hotel prices, and leaves out the ones none does", async () => {
    const veg: HotelCompareItem = {
      ...HAVELI,
      rates: {
        status: "stale",
        asOf: "2026-06-14T06:30:00.000Z",
        items: [
          {
            itemType: "per_plate_veg",
            amount: { minor: 140000, currency: "INR" },
            amountMax: null,
            unit: "per_plate",
            inclusions: null,
          },
        ],
      },
    };
    await renderWithApi(
      <CompareScreen ids={[PAVILION.id, veg.id]} />,
      compareApi([PAVILION, veg]).fetch,
    );
    expect(
      await screen.findByLabelText("Amber Haveli, Per plate, veg: ₹1,400 per plate"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("The Lake Pavilion, Per plate, veg: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Amber Haveli, Room rate: —")).toBeOnTheScreen();
    expect(screen.queryByText("Wedding package")).toBeNull();
  });

  it("holds the table in a glass card whose columns share the width a desktop gives it", async () => {
    mockWindow.width = 1440;
    await renderWithApi(
      <CompareScreen ids={[PAVILION.id, HAVELI.id]} />,
      compareApi([PAVILION, HAVELI]).fetch,
    );
    const head = await screen.findByLabelText("The Lake Pavilion, 5-star");
    expect(screen.getByTestId("compare-card")).toBeOnTheScreen();
    // Columns grow with the row (no fixed width) and keep a floor for a phone.
    expect(String(head.props.className)).toEqual(expect.stringContaining("flex-1"));
    expect(String(head.props.className)).toEqual(expect.stringContaining("min-w-40"));
    await fireEvent(screen.getByLabelText("Hotel comparison"), "layout", {
      nativeEvent: { layout: { width: 1232, height: 600, x: 0, y: 0 } },
    });
    expect(screen.getByTestId("compare-table").props.style).toMatchObject({ width: 1232 });
  });

  it("keeps the table at its floor on a phone, so it scrolls sideways rather than squeeze", async () => {
    await renderWithApi(
      <CompareScreen ids={[PAVILION.id, HAVELI.id]} />,
      compareApi([PAVILION, HAVELI]).fetch,
    );
    await screen.findByLabelText("The Lake Pavilion, 5-star");
    await fireEvent(screen.getByLabelText("Hotel comparison"), "layout", {
      nativeEvent: { layout: { width: 322, height: 600, x: 0, y: 0 } },
    });
    // 96 for the labels, then 160 and a 20 gap per hotel.
    expect(screen.getByTestId("compare-table").props.style).toMatchObject({ width: 456 });
  });

  it("heads a column with the hotel's cover from the shortlist", async () => {
    const saved = pageOf([
      savedFixture(hotelFixture({ coverUrl: COVER_URL }), "018f0000-0000-7000-8000-0000000000a1"),
    ]);
    await renderWithApi(
      <CompareScreen ids={[PAVILION.id, HAVELI.id]} />,
      compareApi([PAVILION, HAVELI], saved).fetch,
    );
    expect(
      await screen.findByLabelText("Photo of The Lake Pavilion", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByLabelText("Photo of Amber Haveli", { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("prompts for a 2–4 selection when too few are chosen", async () => {
    await renderWithApi(<CompareScreen ids={[PAVILION.id]} />, compareApi([]).fetch);
    expect(await screen.findByText("Pick 2 to 4 hotels")).toBeOnTheScreen();
    expect(screen.getByText("My selection")).toBeOnTheScreen();
  });

  it("prompts for a 2–4 selection for more than four ids, never loading forever", async () => {
    await renderWithApi(<CompareScreen ids={["a", "b", "c", "d", "e"]} />, compareApi([]).fetch);
    expect(await screen.findByText("Pick 2 to 4 hotels")).toBeOnTheScreen();
    expect(screen.queryByTestId("compare-loading")).toBeNull();
  });

  it("says so when the compared hotels have dropped off the shortlist", async () => {
    await renderWithApi(
      <CompareScreen ids={[PAVILION.id, HAVELI.id]} />,
      compareApi([PAVILION]).fetch,
    );
    expect(await screen.findByText("Couldn't compare these hotels")).toBeOnTheScreen();
  });
});
