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
  routedFetch,
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

function ratesFetch(captured: Captured, cards = [rateCardViewFixture()]): FetchFn {
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
      return ok({ items: [] });
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
