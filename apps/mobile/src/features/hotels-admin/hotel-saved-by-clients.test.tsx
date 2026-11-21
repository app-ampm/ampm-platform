import { pendingFetch } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import {
  ACCOUNT_ID,
  SAVED_HOTEL_ID,
  savedHotelStaffFixture,
} from "../accounts/accounts.test-utils";
import type * as RouterStub from "../portal/portal.test-router";
import { HotelSavedByClients } from "./hotel-saved-by-clients";
import {
  failure,
  HOTEL_ID,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

const mockPush = jest.fn();

jest.mock("expo-router", () =>
  jest
    .requireActual<typeof RouterStub>("../portal/portal.test-router")
    .expoRouterStub({ push: (href) => mockPush(href) }),
);

const OTHER_ACCOUNT_ID = "018f0000-0000-7000-8000-0000000c2001";

/** The Vermas saved the hotel after the Sharmas, without a note. */
const vermaSave = savedHotelStaffFixture({
  id: "018f0000-0000-7000-8000-0000000c2002",
  account: { id: OTHER_ACCOUNT_ID, name: "The Verma wedding" },
  note: null,
  savedAt: "2026-11-21T09:00:00Z",
});

/** Answers the staff list, recording each address asked for. */
function saversFetch(asked: string[], page: unknown): FetchFn {
  return (input, init) => {
    asked.push(String(input));
    return routedFetch({ "/hotels-admin/saved-hotels": () => ok(page) })(input, init);
  };
}

const page = (items: unknown[], nextCursor: string | null = null) => ({ items, nextCursor });

beforeEach(() => mockPush.mockClear());

describe("HotelSavedByClients", () => {
  it("names every client who saved the hotel, with their note and the day, asking for this hotel only", async () => {
    const asked: string[] = [];
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      saversFetch(asked, page([vermaSave, savedHotelStaffFixture()])),
    );
    expect(await screen.findByText("Saved by 2 clients")).toBeOnTheScreen();
    expect(screen.getByText("The Verma wedding")).toBeOnTheScreen();
    expect(screen.getByText("21 NOV 2026")).toBeOnTheScreen();
    expect(screen.getByText("The Sharma wedding")).toBeOnTheScreen();
    expect(screen.getByText("“Loved the lake-facing lawn”")).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        "The Sharma wedding, note: Loved the lake-facing lawn, saved 20 Nov 2026",
      ),
    ).toBeOnTheScreen();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain(`hotelId=${HOTEL_ID}`);
    expect(asked[0]).not.toContain("accountId=");
  });

  it("opens a client's hub from their row", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      saversFetch([], page([savedHotelStaffFixture()])),
    );
    await fireEvent.press(await screen.findByTestId(`hotel-saver-${SAVED_HOTEL_ID}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/leads/accounts/[accountId]",
      params: { accountId: ACCOUNT_ID },
    });
  });

  it("lists a client as plain text for a reader who may not open the client hub", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient={false} />,
      saversFetch([], page([savedHotelStaffFixture()])),
    );
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /The Sharma wedding/ })).toBeNull();
  });

  it("names one client in the singular", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      saversFetch([], page([savedHotelStaffFixture()])),
    );
    expect(await screen.findByText("Saved by 1 client")).toBeOnTheScreen();
  });

  it("marks the count as a floor while more savers wait, with a footer to load them", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      saversFetch([], page([savedHotelStaffFixture()], "cursor-2")),
    );
    expect(await screen.findByText("Saved by 1+ clients")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-savers-load-more")).toBeOnTheScreen();
  });

  it("says when no client has saved the hotel yet", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      saversFetch([], page([])),
    );
    expect(await screen.findByText("Saved by no clients yet")).toBeOnTheScreen();
    expect(screen.getByText(/Clients appear here as they save this hotel/)).toBeOnTheScreen();
  });

  it("keeps its title over a placeholder while the savers load", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      pendingFetch,
    );
    expect(await screen.findByText("Saved by clients")).toBeOnTheScreen();
  });

  it("offers a retry when the load fails", async () => {
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead canOpenClient />,
      routedFetch({ "/hotels-admin/saved-hotels": () => failure("internal", 500) }),
    );
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("hides itself and sends nothing for a role without the read", async () => {
    const asked: string[] = [];
    await renderWithApi(
      <HotelSavedByClients hotelId={HOTEL_ID} canRead={false} canOpenClient />,
      saversFetch(asked, page([])),
    );
    expect(screen.queryByTestId("hotel-saved-by-clients")).toBeNull();
    expect(asked).toEqual([]);
  });
});
