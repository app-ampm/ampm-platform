import { Text } from "react-native";

import { ME_QUERY_KEY } from "@ampm/api-client";
import type { EntitlementModule } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { SavedHotelsScreen } from "./saved-hotels-screen";
import {
  clientMe,
  fail,
  fakeApi,
  HOTEL_ID,
  hotelFixture,
  offlineFetch,
  ok,
  pageOf,
  pendingFetch,
  renderWithApi,
  savedFixture,
} from "./hotels.test-utils";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockDismissTo = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    replace: jest.fn(),
    push: mockPush,
    dismissTo: mockDismissTo,
  }),
}));

const ENTRY = savedFixture(hotelFixture(), "018f0000-0000-7000-8000-0000000000a1");

/** The shortlist with one hotel; removing it answers as the API does, or fails when `refuse` is set. */
function shortlistApi({ refuse = false }: { readonly refuse?: boolean } = {}) {
  return fakeApi((method, url) => {
    if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf([ENTRY]));
    if (method === "DELETE" && url.pathname === `/hotels/${HOTEL_ID}/save`)
      return refuse ? fail("internal", 500) : ok({ hotelId: HOTEL_ID });
    return undefined;
  });
}

const ROW_NAME = "The Lake Pavilion in Udaipur, Rajasthan, saved 2 Nov 2026";
const REMOVE_NAME = "Remove The Lake Pavilion from your shortlist";

/** An empty shortlist, for an account with these modules. */
function emptyShortlistApi(modules: readonly EntitlementModule[]) {
  return fakeApi((_, url) => {
    if (url.pathname === "/me") return ok(clientMe(modules));
    return url.pathname === "/hotels/saved" ? ok(pageOf([])) : undefined;
  });
}

beforeEach(() => {
  mockBack.mockClear();
  mockPush.mockClear();
  mockDismissTo.mockClear();
});

describe("SavedHotelsScreen", () => {
  it("shows the skeleton while the shortlist loads", async () => {
    await renderWithApi(<SavedHotelsScreen />, pendingFetch);
    expect(screen.getByTestId("saved-hotels-loading")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "My selection" })).toBeOnTheScreen();
  });

  it("lists each saved hotel as a row that opens it", async () => {
    await renderWithApi(<SavedHotelsScreen />, shortlistApi().fetch);
    const row = await screen.findByRole("button", { name: ROW_NAME });
    expect(screen.getByText("1 hotel")).toBeOnTheScreen();
    expect(screen.getByText("Saved 2 NOV 2026")).toBeOnTheScreen();
    expect(screen.getByLabelText("5-star")).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/hotels/[id]", params: { id: HOTEL_ID } });
  });

  it("removes a hotel from the shortlist", async () => {
    const api = shortlistApi();
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    await fireEvent.press(await screen.findByRole("button", { name: REMOVE_NAME }));
    await waitFor(() => expect(api.calls).toContain(`DELETE /hotels/${HOTEL_ID}/save`));
  });

  it("says so when the removal fails", async () => {
    await renderWithApi(<SavedHotelsScreen />, shortlistApi({ refuse: true }).fetch);
    await fireEvent.press(await screen.findByRole("button", { name: REMOVE_NAME }));
    expect(await screen.findByText("Could not remove the hotel")).toBeOnTheScreen();
    // Dismissing also clears the toast's timer, which would otherwise outlive the test.
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.dismiss }));
    expect(screen.queryByText("Could not remove the hotel")).toBeNull();
  });

  it("goes back to the search", async () => {
    await renderWithApi(<SavedHotelsScreen />, pendingFetch);
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.screenHeader.back }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("explains how the shortlist fills when it is empty, and opens the search", async () => {
    const api = emptyShortlistApi(["hotel_discovery", "saved_hotels"]);
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    expect(await screen.findByText("No saved hotels yet")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "Browse hotels" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/hotels");
  });

  it("offers no search to a lapsed subscription, which keeps its saved names only", async () => {
    const api = emptyShortlistApi(["saved_hotels"]);
    const queryClient = await renderWithApi(<SavedHotelsScreen />, api.fetch);
    expect(await screen.findByText("No saved hotels yet")).toBeOnTheScreen();
    await waitFor(() => expect(queryClient.getQueryState(ME_QUERY_KEY)?.status).toBe("success"));
    expect(screen.queryByRole("button", { name: "Browse hotels" })).toBeNull();
  });

  it("asks a signed-out client to sign in", async () => {
    await renderWithApi(<SavedHotelsScreen />, fakeApi(() => fail("unauthenticated", 401)).fetch);
    expect(await screen.findByText("Sign in to view your shortlist")).toBeOnTheScreen();
  });

  it("shows the retryable error state when the API fails", async () => {
    await renderWithApi(<SavedHotelsScreen />, fakeApi(() => fail("internal", 500)).fetch);
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderWithApi(<SavedHotelsScreen />, offlineFetch);
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("places the tab bar the route passes in", async () => {
    await renderWithApi(<SavedHotelsScreen tabBar={<Text>Tab bar</Text>} />, pendingFetch);
    expect(screen.getByText("Tab bar")).toBeOnTheScreen();
  });
});
