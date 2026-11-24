import type { VerificationView } from "@ampm/core";

import { pendingFetch } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { HotelRatesScreen } from "./hotel-rates-screen";
import {
  failure,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  ok,
  RATE_CARD_ID,
  rateCardViewFixture,
  rateItemViewFixture,
  renderWithApi,
  ROOM_ID,
  roomCategoryViewFixture,
  routedFetch,
  VENUE_ID,
  VERIFICATION_ID,
  verificationViewFixture,
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
  createdCard?: unknown;
  createdItem?: unknown;
  recordedVerification?: unknown;
  verifiedBody?: unknown;
  deletedCardMethod?: string | undefined;
}

function ratesFetch(
  captured: Captured,
  cards = [rateCardViewFixture()],
  verifications: readonly VerificationView[] = [],
): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotelStaffDetailViewFixture()),
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards`]: (init) => {
      if (init?.method === "POST") {
        captured.createdCard = JSON.parse(String(init.body));
        return ok(rateCardViewFixture());
      }
      return ok({ items: cards });
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/verifications`]: (init) => {
      if (init?.method === "POST") {
        captured.recordedVerification = JSON.parse(String(init.body));
        return ok(verificationViewFixture());
      }
      return ok({ items: verifications });
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards/${RATE_CARD_ID}`]: (init) => {
      captured.deletedCardMethod = init?.method;
      return ok({ id: RATE_CARD_ID });
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards/${RATE_CARD_ID}/items`]: (init) => {
      captured.createdItem = JSON.parse(String(init?.body));
      return ok(rateItemViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards/${RATE_CARD_ID}/verify`]: (init) => {
      captured.verifiedBody = JSON.parse(String(init?.body));
      return ok(rateCardViewFixture({ status: "verified" }));
    },
  });
}

describe("HotelRatesScreen", () => {
  it("shows the loading state while the rate cards load", async () => {
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, pendingFetch);
    expect(await screen.findByTestId("rates-loading")).toBeOnTheScreen();
  });

  it("shows an error with a retry when the rate cards fail to load", async () => {
    const fetch = routedFetch({
      [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotelStaffDetailViewFixture()),
      [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards`]: () => failure("internal", 500),
    });
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, fetch);
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("lists the cards with their status, items, money range and client flag", async () => {
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, ratesFetch({}));
    expect(await screen.findByText("Wedding season 2027")).toBeOnTheScreen();
    expect(screen.getByText("Draft")).toBeOnTheScreen();
    expect(screen.getByText("Room rate")).toBeOnTheScreen();
    expect(screen.getByText(/16,000/)).toBeOnTheScreen();
    expect(screen.getByText("per night")).toBeOnTheScreen();
    expect(screen.getByText("Client")).toBeOnTheScreen();
  });

  it("names the room or venue each item prices, from the hotel the screen already reads", async () => {
    const RENTAL_ID = "018f0000-0000-7000-8000-0000000c1102";
    const items = [
      rateItemViewFixture({ roomCategoryId: ROOM_ID }),
      rateItemViewFixture({ id: RENTAL_ID, itemType: "venue_rental", venueId: VENUE_ID }),
    ];
    const hotel = hotelStaffDetailViewFixture({ rooms: [roomCategoryViewFixture()] });
    const fetch = routedFetch({
      [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotel),
      [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards`]: () =>
        ok({ items: [rateCardViewFixture({ items })] }),
    });
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, fetch);
    expect(await screen.findByText("Room rate · Deluxe Lake View")).toBeOnTheScreen();
    expect(screen.getByText("Venue rental · a removed venue")).toBeOnTheScreen();
    expect(screen.getByLabelText("Edit Room rate for Deluxe Lake View")).toBeOnTheScreen();
  });

  it("adds a rate card", async () => {
    const captured: Captured = {};
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, ratesFetch(captured, []));
    await fireEvent.press(await screen.findByTestId("rate-card-add"));
    await fireEvent.changeText(await screen.findByTestId("rate-card-name"), "Off season");
    await fireEvent.press(screen.getByTestId("rate-card-edit-submit"));
    expect(await screen.findByText("Rate card added")).toBeOnTheScreen();
    expect(captured.createdCard).toMatchObject({ name: "Off season", currency: "INR" });
  });

  it("adds a rate item to a card, converting rupees to wire paise", async () => {
    const captured: Captured = {};
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, ratesFetch(captured));
    await fireEvent.press(await screen.findByTestId(`rate-card-${RATE_CARD_ID}-add-item`));
    await fireEvent.changeText(await screen.findByTestId("rate-item-amount"), "30000");
    await fireEvent.press(screen.getByTestId("rate-item-edit-submit"));
    expect(await screen.findByText("Rate item added")).toBeOnTheScreen();
    expect(captured.createdItem).toMatchObject({ amount: { minor: 3000000, currency: "INR" } });
  });

  it("verifies a card: records a verification then publishes against it", async () => {
    const captured: Captured = {};
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, ratesFetch(captured));
    await fireEvent.press(await screen.findByTestId(`rate-card-${RATE_CARD_ID}-verify`));
    await fireEvent.press(await screen.findByTestId("verify-card-submit"));
    expect(await screen.findByText("Rate card verified")).toBeOnTheScreen();
    expect(captured.recordedVerification).toMatchObject({ fieldGroup: "rates", source: "phone" });
    expect(captured.verifiedBody).toEqual({ verificationId: VERIFICATION_ID });
  });

  it("offers only a current rates verification to reuse, and verifies against it (AC-04.4)", async () => {
    const captured: Captured = {};
    const STALE_ID = "018f0000-0000-7000-8000-0000000c1203";
    const ROOMS_ID = "018f0000-0000-7000-8000-0000000c1204";
    const verifications = [
      verificationViewFixture(),
      verificationViewFixture({ id: STALE_ID, status: "stale" }),
      verificationViewFixture({ id: ROOMS_ID, fieldGroup: "rooms" }),
    ];
    await renderWithApi(
      <HotelRatesScreen hotelId={HOTEL_ID} />,
      ratesFetch(captured, undefined, verifications),
    );
    await fireEvent.press(await screen.findByTestId(`rate-card-${RATE_CARD_ID}-verify`));
    await fireEvent.press(await screen.findByTestId(`verify-use-${VERIFICATION_ID}`));
    expect(screen.queryByTestId(`verify-use-${STALE_ID}`)).toBeNull();
    expect(screen.queryByTestId(`verify-use-${ROOMS_ID}`)).toBeNull();
    expect(await screen.findByText("Rate card verified")).toBeOnTheScreen();
    expect(captured.verifiedBody).toEqual({ verificationId: VERIFICATION_ID });
    expect(captured.recordedVerification).toBeUndefined(); // reused, not recorded again
  });

  it("removes a card after confirming", async () => {
    const captured: Captured = {};
    await renderWithApi(<HotelRatesScreen hotelId={HOTEL_ID} />, ratesFetch(captured));
    await fireEvent.press(await screen.findByTestId(`rate-card-${RATE_CARD_ID}-delete`));
    expect(await screen.findByText(/Remove Wedding season 2027/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`rate-card-${RATE_CARD_ID}-remove-confirm`));
    expect(await screen.findByText("Wedding season 2027 removed")).toBeOnTheScreen();
    expect(captured.deletedCardMethod).toBe("DELETE");
  });
});
