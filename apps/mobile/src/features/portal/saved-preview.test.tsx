import { fireEvent, screen } from "../../test/render";
import {
  JAIPUR,
  fakeApi,
  hotelFixture,
  offlineFetch,
  ok,
  pendingFetch,
  renderWithApi,
  savedFixture,
} from "../hotels/hotels.test-utils";
import { SavedPreview } from "./saved-preview";
import type * as RouterStub from "./portal.test-router";

const mockPush = jest.fn();
jest.mock("expo-router", () =>
  jest
    .requireActual<typeof RouterStub>("./portal.test-router")
    .expoRouterStub({ push: (href) => mockPush(href) }),
);

const ENTRY = savedFixture(hotelFixture(), "018f0000-0000-7000-8000-0000000000a1");
const SECOND = savedFixture(
  hotelFixture({
    id: "018f0000-0000-7000-8000-00000000b0b0",
    name: "Rose Fort Palace",
    destination: JAIPUR,
    starCategory: null,
  }),
  "018f0000-0000-7000-8000-0000000000a2",
);

function savedApi(items: readonly unknown[]) {
  return fakeApi((method, url) =>
    method === "GET" && url.pathname === "/hotels/saved"
      ? ok({ items, nextCursor: null })
      : undefined,
  );
}

beforeEach(() => mockPush.mockClear());

describe("SavedPreview (home, B16; My selection in P2 and D4)", () => {
  it("lists the saved hotels as compact rows that open the hotel, and links to the shortlist", async () => {
    await renderWithApi(<SavedPreview />, savedApi([ENTRY]).fetch);
    const row = await screen.findByRole("button", {
      name: "The Lake Pavilion in Udaipur, Rajasthan",
    });
    // P2's compact row: the place and seats on one line, the star category as the chip.
    expect(screen.getByText("Udaipur · Seats 500–900")).toBeOnTheScreen();
    expect(screen.getByText("5-star")).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/[id]",
      params: { id: ENTRY.hotel.id },
    });
    await fireEvent.press(screen.getByRole("link", { name: "See all" }));
    expect(mockPush).toHaveBeenLastCalledWith("/hotels/saved");
    // One hotel has nothing to compare it with.
    expect(screen.queryByRole("link", { name: "Compare these hotels" })).toBeNull();
  });

  it("compares the previewed hotels once there are two", async () => {
    await renderWithApi(<SavedPreview />, savedApi([ENTRY, SECOND]).fetch);
    await fireEvent.press(await screen.findByRole("link", { name: "Compare these hotels" }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/compare",
      params: { ids: `${ENTRY.hotel.id},${SECOND.hotel.id}` },
    });
    // A hotel without a star category has no chip, and no full discovery card is drawn.
    expect(screen.getAllByText(/-star$/)).toHaveLength(1);
    expect(screen.queryByText(ENTRY.hotel.description ?? "")).toBeNull();
  });

  it("falls back to the shortlist prompt when nothing is saved", async () => {
    await renderWithApi(<SavedPreview />, savedApi([]).fetch);
    expect(
      await screen.findByText("Save a hotel from discovery to build your shortlist."),
    ).toBeOnTheScreen();
  });

  it("announces a loading skeleton while the shortlist loads", async () => {
    await renderWithApi(<SavedPreview />, pendingFetch);
    expect(screen.getByTestId("saved-preview-loading")).toBeOnTheScreen();
  });

  it("falls back to the shortlist link on an error, keeping a way in", async () => {
    await renderWithApi(<SavedPreview />, offlineFetch);
    expect(await screen.findByText("Open your shortlist.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /Saved hotels/ }));
    expect(mockPush).toHaveBeenCalledWith("/hotels/saved");
  });
});
