import { pendingFetch } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import type * as RouterStub from "../portal/portal.test-router";
import { AccountSavedHotels } from "./account-saved-hotels";
import {
  ACCOUNT_ID,
  SAVED_HOTEL_HOTEL_ID,
  SAVED_HOTEL_ID,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  savedHotelStaffFixture,
  type FetchFn,
} from "./accounts.test-utils";

const mockPush = jest.fn();

jest.mock("expo-router", () =>
  jest
    .requireActual<typeof RouterStub>("../portal/portal.test-router")
    .expoRouterStub({ push: (href) => mockPush(href) }),
);

const SECOND_ID = "018f0000-0000-7000-8000-0000000d0016";

const inactiveSave = savedHotelStaffFixture({
  id: SECOND_ID,
  hotel: {
    id: "018f0000-0000-7000-8000-0000000d0017",
    name: "Rose Fort Palace",
    starCategory: null,
    status: "inactive",
    destinationName: "Jaipur",
  },
  note: null,
  savedAt: "2026-11-18T10:00:00Z",
});

/** Answers the staff list, recording each address asked for. */
function savedFetch(asked: string[], page: unknown): FetchFn {
  return (input, init) => {
    asked.push(String(input));
    return routedFetch({ "/hotels-admin/saved-hotels": () => ok(page) })(input, init);
  };
}

beforeEach(() => mockPush.mockClear());

describe("AccountSavedHotels", () => {
  it("lists the client's saved hotels with the place, the note and the day, asking for this client only", async () => {
    const asked: string[] = [];
    const page = { items: [savedHotelStaffFixture(), inactiveSave], nextCursor: null };
    await renderWithApi(
      <AccountSavedHotels accountId={ACCOUNT_ID} canRead />,
      savedFetch(asked, page),
    );
    expect(await screen.findByText("Saved hotels · 2")).toBeOnTheScreen();
    expect(screen.getByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(screen.getByText("Udaipur · 5-star · “Loved the lake-facing lawn”")).toBeOnTheScreen();
    expect(screen.getByText("20 NOV 2026")).toBeOnTheScreen();
    expect(screen.getByText("Jaipur")).toBeOnTheScreen();
    expect(screen.getByText("Inactive")).toBeOnTheScreen();
    expect(asked[0]).toContain(`accountId=${ACCOUNT_ID}`);
  });

  it("opens a saved hotel's profile in the catalogue", async () => {
    const page = { items: [savedHotelStaffFixture()], nextCursor: null };
    await renderWithApi(
      <AccountSavedHotels accountId={ACCOUNT_ID} canRead />,
      savedFetch([], page),
    );
    await fireEvent.press(await screen.findByTestId(`account-saved-hotel-${SAVED_HOTEL_ID}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels-admin/[hotelId]/details",
      params: { hotelId: SAVED_HOTEL_HOTEL_ID },
    });
  });

  it("says when the client has saved nothing yet", async () => {
    await renderWithApi(
      <AccountSavedHotels accountId={ACCOUNT_ID} canRead />,
      savedFetch([], { items: [], nextCursor: null }),
    );
    expect(await screen.findByText(/No saved hotels yet/)).toBeOnTheScreen();
  });

  it("shows a skeleton while loading and a retry when the load fails", async () => {
    await renderWithApi(<AccountSavedHotels accountId={ACCOUNT_ID} canRead />, pendingFetch);
    expect(await screen.findByText("Saved hotels")).toBeOnTheScreen();
    screen.unmount();
    await renderWithApi(
      <AccountSavedHotels accountId={ACCOUNT_ID} canRead />,
      routedFetch({ "/hotels-admin/saved-hotels": () => failure("internal", 500) }),
    );
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("hides itself and sends nothing for a role without the read", async () => {
    const asked: string[] = [];
    await renderWithApi(
      <AccountSavedHotels accountId={ACCOUNT_ID} canRead={false} />,
      savedFetch(asked, { items: [], nextCursor: null }),
    );
    expect(screen.queryByTestId("account-saved-hotels")).toBeNull();
    expect(asked).toEqual([]);
  });
});
