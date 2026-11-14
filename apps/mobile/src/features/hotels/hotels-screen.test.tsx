import { AccessibilityInfo, Text } from "react-native";

import type { HotelView, MeResponse } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { HotelsScreen } from "./hotels-screen";
import {
  clientMe,
  COVER_URL,
  fail,
  fakeApi,
  hotelFixture,
  JAIPUR,
  offlineFetch,
  ok,
  pageOf,
  pendingFetch,
  renderWithApi,
  type ApiReply,
} from "./hotels.test-utils";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();

// The window decides the arrangement: P3's Filters sheet on a phone, filter rows from 768, D5 from 1024.
const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: mockReplace,
    push: mockPush,
    dismissTo: mockDismissTo,
  }),
}));

const PAVILION = hotelFixture();
const HAVELI = hotelFixture({
  id: "018f0000-0000-7000-8000-00000000cafe",
  slug: "amber-haveli-jaipur",
  name: "Amber Haveli",
  starCategory: null,
  destination: JAIPUR,
  description: null,
  totalRooms: null,
});

/** A subscriber: hotel discovery and a shortlist. */
const SUBSCRIBER = clientMe(["hotel_discovery", "saved_hotels"]);

/**
 * `/me` answering with this account, and `GET /hotels` with these hotels, narrowed by
 * `destinationId` as the API does (or with `search` instead, to fail or refuse it).
 */
function catalogue(
  hotels: readonly HotelView[],
  { me = SUBSCRIBER, search }: { readonly me?: MeResponse; readonly search?: ApiReply } = {},
) {
  return fakeApi((method, url) => {
    if (url.pathname === "/me") return ok(me);
    if (method !== "GET" || url.pathname !== "/hotels") return undefined;
    if (search) return search;
    const destinationId = url.searchParams.get("destinationId");
    return ok(pageOf(hotels.filter((h) => !destinationId || h.destination.id === destinationId)));
  });
}

const searched = (calls: readonly string[]) => calls.some((call) => call.startsWith("GET /hotels"));

beforeEach(() => {
  mockWindow.width = 390;
  mockPush.mockClear();
  mockReplace.mockClear();
  mockDismissTo.mockClear();
});

describe("HotelsScreen", () => {
  it("shows the result skeletons while the account and the search are pending", async () => {
    await renderWithApi(<HotelsScreen />, pendingFetch);
    expect(screen.getByTestId("hotels-loading")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Hotels" })).toBeOnTheScreen();
  });

  it("lists the results as glass cards that open the hotel", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    const card = await screen.findByRole("button", {
      name: /The Lake Pavilion in Udaipur, Rajasthan/,
    });
    expect(screen.getByText("2 hotels")).toBeOnTheScreen();
    expect(screen.getByText("Udaipur, Rajasthan · 84 rooms")).toBeOnTheScreen();
    expect(screen.getByLabelText("5-star")).toBeOnTheScreen();
    expect(screen.getByRole("image", { name: "Hotel photo · Udaipur" })).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/[id]",
      params: { id: PAVILION.id },
    });
  });

  it("shows the hotel's cover photo on the card when one is set, replacing the placeholder", async () => {
    const withCover = hotelFixture({ coverUrl: COVER_URL });
    await renderWithApi(<HotelsScreen />, catalogue([withCover]).fetch);
    // The real photo (its alt) appears, and the striped stand-in (role image, its label) is gone.
    expect(await screen.findByLabelText("Photo of The Lake Pavilion")).toBeOnTheScreen();
    expect(screen.queryByRole("image", { name: "Hotel photo · Udaipur" })).toBeNull();
  });

  it("searches by hotel name", async () => {
    const api = catalogue([PAVILION]);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByText("1 hotel");
    await fireEvent.changeText(screen.getByLabelText("Search hotels"), " Lake ");
    await waitFor(() => expect(api.calls).toContain("GET /hotels?q=Lake&limit=50"));
  });

  it("loads the next page of results from the footer (B10)", async () => {
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(SUBSCRIBER);
      if (method !== "GET" || url.pathname !== "/hotels") return undefined;
      // Page 1 has a cursor; page 2 (requested with it) is the last.
      return url.searchParams.get("cursor") === "p2"
        ? ok(pageOf([HAVELI]))
        : ok(pageOf([PAVILION], "p2"));
    });
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByRole("button", { name: /The Lake Pavilion in Udaipur, Rajasthan/ });
    await fireEvent.press(screen.getByTestId("hotels-load-more"));
    expect(
      await screen.findByRole("button", { name: /Amber Haveli in Jaipur, Rajasthan/ }),
    ).toBeOnTheScreen();
    // The first page stays on screen — the next page is appended, not replaced.
    expect(
      screen.getByRole("button", { name: /The Lake Pavilion in Udaipur, Rajasthan/ }),
    ).toBeOnTheScreen();
    expect(api.calls).toContain("GET /hotels?cursor=p2&limit=50");
  });

  it("narrows the results to a destination chip and clears it on a second tap", async () => {
    const api = catalogue([PAVILION, HAVELI]);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Jaipur" }));
    await waitFor(() =>
      expect(api.calls).toContain(`GET /hotels?destinationId=${JAIPUR.id}&limit=50`),
    );
    expect(await screen.findByRole("header", { name: "Jaipur" })).toBeOnTheScreen();
    expect(await screen.findByText("1 hotel")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Jaipur" })).toBeSelected();
    expect(screen.queryByRole("button", { name: "Udaipur" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Jaipur" }));
    expect(await screen.findByRole("header", { name: "Hotels" })).toBeOnTheScreen();
    expect(await screen.findByText("2 hotels")).toBeOnTheScreen();
  });

  it("offers no destination chips when every result is in one destination", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION]).fetch);
    await screen.findByText("1 hotel");
    expect(screen.queryByRole("button", { name: "Udaipur" })).toBeNull();
  });

  it("opens the shortlist from the glass button", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION]).fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Saved" }));
    expect(mockPush).toHaveBeenCalledWith("/hotels/saved");
  });

  it("opens the destinations browse from the header", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION]).fetch);
    await fireEvent.press(await screen.findByRole("button", { name: "Browse destinations" }));
    expect(mockPush).toHaveBeenCalledWith("/hotels/destinations");
  });

  it("says when nothing matches", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([]).fetch);
    expect(await screen.findByText("No hotels found")).toBeOnTheScreen();
  });

  it("filters to verified rates only and carries it to the search", async () => {
    const api = catalogue([PAVILION]);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByText("1 hotel");
    await fireEvent.press(screen.getByRole("button", { name: "Verified rates only" }));
    await waitFor(() => expect(api.calls).toContain("GET /hotels?verifiedRatesOnly=true&limit=50"));
  });

  it("sends the guest-capacity minimum chosen in the phone's filter sheet (P3)", async () => {
    const api = catalogue([PAVILION]);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByText("1 hotel");
    // A phone keeps the selects off its row, where they would truncate to "Any …".
    expect(screen.queryByTestId("hotel-filter-capacity")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(await screen.findByTestId("hotel-filter-capacity-option-500"));
    await waitFor(() => expect(api.calls).toContain("GET /hotels?minGuestCapacity=500&limit=50"));
    expect(screen.getByTestId("hotel-filter-capacity-option-500")).toBeSelected();
  });

  it("sends the guest-capacity minimum chosen in the select from 768", async () => {
    mockWindow.width = 768;
    const api = catalogue([PAVILION]);
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByText("1 hotel");
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    expect(screen.queryByTestId("hotel-search-pill")).toBeNull();
    await fireEvent.press(screen.getByTestId("hotel-filter-capacity"));
    await fireEvent.press(await screen.findByTestId("hotel-filter-capacity-option-500"));
    await waitFor(() => expect(api.calls).toContain("GET /hotels?minGuestCapacity=500&limit=50"));
  });

  it("offers to clear the filters when none match, and restores the results", async () => {
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(SUBSCRIBER);
      if (method !== "GET" || url.pathname !== "/hotels") return undefined;
      // Nothing meets the capacity filter; without it the one hotel shows.
      return ok(pageOf(url.searchParams.has("minGuestCapacity") ? [] : [PAVILION]));
    });
    mockWindow.width = 1440;
    await renderWithApi(<HotelsScreen />, api.fetch);
    await screen.findByText("1 hotel");
    await fireEvent.press(screen.getByTestId("hotel-filter-capacity"));
    await fireEvent.press(await screen.findByTestId("hotel-filter-capacity-option-1000"));
    expect(await screen.findByText("No hotels match these filters")).toBeOnTheScreen();
    // The chips stay above the empty state, so the filters remain in reach.
    expect(screen.getByRole("button", { name: "Verified rates only" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("1 hotel")).toBeOnTheScreen();
  });

  it("announces the result count to assistive tech when a search settles", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    announce.mockClear();
    await renderWithApi(<HotelsScreen />, catalogue([PAVILION, HAVELI]).fetch);
    await screen.findByText("2 hotels");
    expect(announce).toHaveBeenCalledWith("2 hotels", { queue: true });
    announce.mockRestore();
  });

  it("asks a signed-out client to sign in", async () => {
    await renderWithApi(<HotelsScreen />, fakeApi(() => fail("unauthenticated", 401)).fetch);
    expect(await screen.findByText("Sign in to browse hotels")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the retryable error state when the search fails", async () => {
    const api = catalogue([], { search: fail("internal", 500) });
    await renderWithApi(<HotelsScreen />, api.fetch);
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: uiCopy.retry })).toBeOnTheScreen();
  });

  it("shows the retryable error state when the account cannot be read", async () => {
    await renderWithApi(<HotelsScreen />, fakeApi(() => fail("internal", 500)).fetch);
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderWithApi(<HotelsScreen />, offlineFetch);
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("places the tab bar the route passes in", async () => {
    await renderWithApi(<HotelsScreen tabBar={<Text>Tab bar</Text>} />, pendingFetch);
    expect(screen.getByText("Tab bar")).toBeOnTheScreen();
  });
});

describe("HotelsScreen without hotel discovery", () => {
  it("points a client who has not paid to the plans, and never searches", async () => {
    const api = catalogue([PAVILION], { me: clientMe([]) });
    await renderWithApi(<HotelsScreen />, api.fetch);
    expect(await screen.findByText("Subscribe to unlock hotel discovery")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Search hotels")).toBeNull();
    expect(screen.queryByRole("button", { name: "Browse destinations" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Saved" })).toBeNull();
    expect(searched(api.calls)).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "See plans" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/portal");
  });

  it("keeps the shortlist in reach of a lapsed subscription", async () => {
    const api = catalogue([PAVILION], { me: clientMe(["saved_hotels", "hotel_assistance"]) });
    await renderWithApi(<HotelsScreen />, api.fetch);
    expect(await screen.findByText("Subscribe to unlock hotel discovery")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Saved" }));
    expect(mockPush).toHaveBeenCalledWith("/hotels/saved");
    expect(searched(api.calls)).toBe(false);
  });

  it("explains a search the server refuses instead of offering a retry", async () => {
    const api = catalogue([], { search: fail("not_found", 404) });
    await renderWithApi(<HotelsScreen />, api.fetch);
    expect(await screen.findByText("Subscribe to unlock hotel discovery")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: uiCopy.retry })).toBeNull();
  });
});
