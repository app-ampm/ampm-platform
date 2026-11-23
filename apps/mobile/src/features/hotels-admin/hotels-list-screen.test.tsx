import { uiCopy } from "@ampm/ui";

import { act, fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelsListScreen } from "./hotels-list-screen";
import {
  destinationListItemFixture,
  failure,
  HOTEL_ID,
  hotelStaffViewFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

type Roles = ReturnType<typeof staffMeFixture>["roles"];

const hotelsFetch = (items = [hotelStaffViewFixture()], roles: Roles = ["HT"]): FetchFn =>
  routedFetch({
    "/hotels-admin/hotels": () => ok({ items, nextCursor: null }),
    "/hotels-admin/destinations": () => ok({ items: [destinationListItemFixture()] }),
    "/me": () => ok(staffMeFixture(roles)),
  });

const SECOND_HOTEL_ID = "018f0000-0000-7000-8000-0000000c0003";

/** Page 1 (one hotel, more waiting) then page 2 (one more, the end) by cursor; the rest as usual. */
const pagedHotelsFetch = (): FetchFn => (input, init) => {
  const url = new URL(String(input));
  if (!url.pathname.endsWith("/hotels-admin/hotels")) return hotelsFetch()(input, init);
  const page = url.searchParams.get("cursor")
    ? {
        items: [hotelStaffViewFixture({ id: SECOND_HOTEL_ID, name: "The Desert Fort" })],
        nextCursor: null,
      }
    : { items: [hotelStaffViewFixture()], nextCursor: HOTEL_ID };
  return Promise.resolve(ok(page));
};

beforeEach(() => {
  mockPush.mockClear();
});

describe("HotelsListScreen", () => {
  it("lists hotels and opens one's photos from its row", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    await fireEvent.press(await screen.findByLabelText(/The Lakeside Palace, active/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels-admin/[hotelId]",
      params: { hotelId: HOTEL_ID },
    });
  });

  it("loads the next page from the footer, appends it, and hides the footer at the end", async () => {
    await renderWithApi(<HotelsListScreen />, pagedHotelsFetch());
    expect(await screen.findByLabelText(/The Lakeside Palace, active/)).toBeOnTheScreen();
    expect(screen.getByText("Hotels · 1+")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId("hotels-load-more"));
    expect(await screen.findByLabelText(/The Desert Fort, active/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/The Lakeside Palace, active/)).toBeOnTheScreen();
    expect(screen.getByText("Hotels · 2")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotels-load-more")).toBeNull();
  });

  it("offers no next page when the catalogue fits in one", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    expect(await screen.findByText("Hotels · 1")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotels-load-more")).toBeNull();
  });

  it("says when there are no hotels", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch([]));
    expect(await screen.findByText("No hotels yet")).toBeOnTheScreen();
  });

  it("opens the editor to add a hotel", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    await fireEvent.press(await screen.findByTestId("hotel-new"));
    expect(await screen.findByTestId("hotel-profile-submit")).toBeOnTheScreen();
  });

  it("navigates to the destinations from the header", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    await fireEvent.press(await screen.findByTestId("hotel-destinations-link"));
    expect(mockPush).toHaveBeenCalledWith("/hotels-admin/destinations");
  });

  it("sends the Hotel team from an empty New hotel form to Destinations, closing the form", async () => {
    const noDestinations = routedFetch({
      "/hotels-admin/hotels": () => ok({ items: [], nextCursor: null }),
      "/hotels-admin/destinations": () => ok({ items: [] }),
      "/me": () => ok(staffMeFixture(["HT"])),
    });
    await renderWithApi(<HotelsListScreen />, noDestinations);
    await fireEvent.press(await screen.findByTestId("hotel-new"));
    await fireEvent.press(await screen.findByTestId("hotel-destination-add"));
    expect(mockPush).toHaveBeenCalledWith("/hotels-admin/destinations");
    expect(screen.queryByTestId("hotel-profile-submit")).toBeNull();
  });

  it("navigates to the bulk import from the header", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    await fireEvent.press(await screen.findByTestId("hotel-import-link"));
    expect(mockPush).toHaveBeenCalledWith("/hotels-admin/import");
  });

  it("links the Hotel team to every client's saved hotels from the header", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    await fireEvent.press(await screen.findByTestId("hotels-saved-by-clients-link"));
    expect(mockPush).toHaveBeenCalledWith("/leads/saved-hotels");
  });

  it("offers no saved-hotels link to a role without the read", async () => {
    // A Project Manager's saved-hotels grant is scoped to assigned weddings, which this route has none of.
    await renderWithApi(<HotelsListScreen />, hotelsFetch(undefined, ["PM"]));
    expect(await screen.findByLabelText(/The Lakeside Palace, active/)).toBeOnTheScreen();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByTestId("hotel-import-link")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotels-saved-by-clients-link")).toBeNull();
  });

  it("shows the error state when the API fails", async () => {
    await renderWithApi(
      <HotelsListScreen />,
      routedFetch({ "/hotels-admin/hotels": () => failure("internal", 500) }),
    );
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderWithApi(
      <HotelsListScreen />,
      routedFetch({ "/hotels-admin/hotels": () => failure("unauthenticated", 401) }),
    );
    expect(await screen.findByText("Sign in to view the hotel catalogue")).toBeOnTheScreen();
  });
});
