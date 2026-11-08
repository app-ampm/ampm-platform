import { Text } from "react-native";

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
      name: "The Lake Pavilion in Udaipur, Rajasthan",
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

  it("says when nothing matches", async () => {
    await renderWithApi(<HotelsScreen />, catalogue([]).fetch);
    expect(await screen.findByText("No hotels found")).toBeOnTheScreen();
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
