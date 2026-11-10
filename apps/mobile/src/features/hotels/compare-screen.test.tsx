import type { HotelCompareItem } from "@ampm/core";

import { screen, waitFor } from "../../test/render";
import { CompareScreen } from "./compare-screen";
import { fakeApi, hotelFixture, JAIPUR, ok, renderWithApi } from "./hotels.test-utils";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
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

function compareApi(items: readonly HotelCompareItem[]) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === "/hotels/compare" ? ok({ items }) : undefined,
  );
}

beforeEach(() => mockBack.mockClear());

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
    expect(screen.getByLabelText("Amber Haveli, Rooms: 52 rooms")).toBeOnTheScreen();
    // The values still render visually (collapsed under their cell's a11y node).
    expect(screen.getByText("per room / night", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("On request", { includeHiddenElements: true })).toBeOnTheScreen();
    await waitFor(() =>
      expect(api.calls.some((call) => call.startsWith("GET /hotels/compare"))).toBe(true),
    );
  });

  it("prompts for a 2–4 selection when too few are chosen", async () => {
    await renderWithApi(<CompareScreen ids={[PAVILION.id]} />, compareApi([]).fetch);
    expect(await screen.findByText("Pick 2 to 4 hotels")).toBeOnTheScreen();
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
