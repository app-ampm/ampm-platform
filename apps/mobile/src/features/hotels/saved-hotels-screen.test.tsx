import { Text } from "react-native";

import { ME_QUERY_KEY } from "@ampm/api-client";
import type { EntitlementModule } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor, within } from "../../test/render";
import { SavedHotelsScreen } from "./saved-hotels-screen";
import {
  clientMe,
  COVER_URL,
  fail,
  fakeApi,
  HOTEL_ID,
  hotelFixture,
  JAIPUR,
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

const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
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
  mockWindow.width = 390;
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

  it("shows the saved hotel's cover photo when one is set, replacing the placeholder", async () => {
    const entry = savedFixture(
      hotelFixture({ coverUrl: COVER_URL }),
      "018f0000-0000-7000-8000-0000000000a2",
    );
    const api = fakeApi((method, url) =>
      method === "GET" && url.pathname === "/hotels/saved" ? ok(pageOf([entry])) : undefined,
    );
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    // The row's Pressable collapses its children into one a11y element (the row names the hotel), so the
    // decorative cover is hidden from the default query — it still renders, replacing the striped stand-in.
    expect(
      await screen.findByLabelText("Photo of The Lake Pavilion", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole("image", { name: "Hotel photo · Udaipur", includeHiddenElements: true }),
    ).toBeNull();
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

  it("picks two saved hotels in compare mode and opens the side-by-side", async () => {
    const a = savedFixture(hotelFixture(), "018f0000-0000-7000-8000-0000000000a1");
    const b = savedFixture(
      hotelFixture({
        id: "018f0000-0000-7000-8000-00000000cafe",
        slug: "amber-haveli-jaipur",
        name: "Amber Haveli",
        destination: JAIPUR,
      }),
      "018f0000-0000-7000-8000-0000000000a2",
    );
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(clientMe(["hotel_discovery", "saved_hotels"]));
      if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf([a, b]));
      return undefined;
    });
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    await screen.findByText("2 hotels");
    await fireEvent.press(await screen.findByRole("button", { name: "Compare" }));
    await fireEvent.press(screen.getByTestId(`compare-select-${a.hotel.id}`));
    await fireEvent.press(screen.getByTestId(`compare-select-${b.hotel.id}`));
    await fireEvent.press(screen.getByRole("button", { name: "Compare" }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels/compare",
      params: { ids: `${a.hotel.id},${b.hotel.id}` },
    });
  });

  it("shows a saved hotel's note under its row, with an Edit affordance", async () => {
    const withNote = { ...ENTRY, note: "Great lawn, waiting on a quote" };
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(clientMe(["hotel_discovery", "saved_hotels"]));
      return method === "GET" && url.pathname === "/hotels/saved"
        ? ok(pageOf([withNote]))
        : undefined;
    });
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    expect(await screen.findByText("Great lawn, waiting on a quote")).toBeOnTheScreen();
    // With a note the editor affordance reads "Edit", not "Add".
    expect(
      screen.getByRole("button", { name: "Edit note for The Lake Pavilion" }),
    ).toBeOnTheScreen();
  });

  it("edits a saved hotel's note from the sheet (PATCH /hotels/:id/save)", async () => {
    const api = fakeApi((method, url) => {
      if (url.pathname === "/me") return ok(clientMe(["hotel_discovery", "saved_hotels"]));
      if (method === "GET" && url.pathname === "/hotels/saved") return ok(pageOf([ENTRY]));
      if (method === "PATCH" && url.pathname === `/hotels/${HOTEL_ID}/save`)
        return ok({ ...ENTRY, note: "Great lawn" });
      return undefined;
    });
    await renderWithApi(<SavedHotelsScreen />, api.fetch);
    // ENTRY has no note, so the affordance is "Add a note"; it opens the editor sheet.
    await fireEvent.press(
      await screen.findByRole("button", { name: "Add a note for The Lake Pavilion" }),
    );
    await fireEvent.changeText(await screen.findByLabelText("Your note"), "Great lawn");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(api.calls).toContain(`PATCH /hotels/${HOTEL_ID}/save`));
  });
});

describe("SavedHotelsScreen rows on a phone", () => {
  it("lets a long name wrap and sets the star chip under it, beside the destination", async () => {
    await renderWithApi(<SavedHotelsScreen />, shortlistApi().fetch);
    const row = await screen.findByRole("button", { name: ROW_NAME });
    const name = within(row).getByText("The Lake Pavilion", { includeHiddenElements: true });
    // The name no longer shares its line with the chip and the two buttons, so it is never cut to one line.
    expect(name.props.numberOfLines).toBe(2);
    const destination = within(row).getByText("Udaipur, Rajasthan", {
      includeHiddenElements: true,
    });
    expect(
      within(destination.parent!.parent!).getByLabelText("5-star", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("saved-grid")).toBeNull();
  });
});
