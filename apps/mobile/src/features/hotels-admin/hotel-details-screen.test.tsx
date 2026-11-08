import { pendingFetch } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { HotelDetailsScreen } from "./hotel-details-screen";
import {
  CONTACT_ID,
  failure,
  HOTEL_ID,
  hotelContactViewFixture,
  hotelStaffDetailViewFixture,
  ok,
  renderWithApi,
  ROOM_ID,
  roomCategoryViewFixture,
  routedFetch,
  venueViewFixture,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

interface Captured {
  createdRoom?: unknown;
  deletedMethod?: string | undefined;
}

/** The hotel detail with one of each subresource, as the screen reads it. */
function loadedDetail() {
  return hotelStaffDetailViewFixture({
    rooms: [roomCategoryViewFixture()],
    venues: [venueViewFixture()],
    contacts: [hotelContactViewFixture()],
  });
}

function detailFetch(captured: Captured): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(loadedDetail()),
    [`/hotels-admin/hotels/${HOTEL_ID}/rooms`]: (init) => {
      captured.createdRoom = JSON.parse(String(init?.body));
      return ok(roomCategoryViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/contacts/${CONTACT_ID}`]: (init) => {
      captured.deletedMethod = init?.method;
      return ok({ id: CONTACT_ID });
    },
  });
}

describe("HotelDetailsScreen", () => {
  it("shows the loading state while the hotel loads", async () => {
    await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, pendingFetch);
    expect(await screen.findByTestId("details-loading")).toBeOnTheScreen();
  });

  it("shows an error with a retry when the hotel fails to load", async () => {
    const fetch = routedFetch({
      [`/hotels-admin/hotels/${HOTEL_ID}`]: () => failure("internal", 500),
    });
    await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, fetch);
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("lists the rooms, venues and contacts, the primary contact tagged", async () => {
    await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, detailFetch({}));
    expect(await screen.findByText("Room categories")).toBeOnTheScreen();
    expect(screen.getByText("Deluxe Lake View")).toBeOnTheScreen();
    expect(screen.getByText("20 rooms · sleeps 3 · 45 sqm")).toBeOnTheScreen();
    expect(screen.getByText("Grand Ballroom")).toBeOnTheScreen();
    expect(screen.getByText("Priya Sharma")).toBeOnTheScreen();
    expect(screen.getByText("Primary")).toBeOnTheScreen();
    // The RESTRICTED-CONTACT marker persists once contacts are populated, not only in the empty state.
    expect(screen.getByText("Never shown to clients")).toBeOnTheScreen();
  });

  it("adds a room from the rooms section", async () => {
    const captured: Captured = {};
    await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, detailFetch(captured));
    await fireEvent.press(await screen.findByTestId("room-section-add"));
    await fireEvent.changeText(await screen.findByTestId("room-name"), "Garden Suite");
    await fireEvent.press(screen.getByTestId("room-edit-submit"));
    expect(await screen.findByText("Room category added")).toBeOnTheScreen();
    expect(captured.createdRoom).toMatchObject({ name: "Garden Suite" });
  });

  it("opens the editor seeded from a row when its edit is pressed", async () => {
    await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, detailFetch({}));
    await fireEvent.press(await screen.findByTestId(`room-${ROOM_ID}-edit`));
    expect(await screen.findByDisplayValue("Deluxe Lake View")).toBeOnTheScreen();
  });

  it("removes a contact after confirming", async () => {
    const captured: Captured = {};
    await renderWithApi(<HotelDetailsScreen hotelId={HOTEL_ID} />, detailFetch(captured));
    await fireEvent.press(await screen.findByTestId(`contact-${CONTACT_ID}-delete`));
    expect(await screen.findByText(/Remove Priya Sharma/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("contact-remove-confirm"));
    expect(await screen.findByText("Priya Sharma removed")).toBeOnTheScreen();
    expect(captured.deletedMethod).toBe("DELETE");
  });
});
