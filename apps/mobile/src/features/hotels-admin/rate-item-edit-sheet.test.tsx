import { fireEvent, screen } from "../../test/render";
import { RateItemEditSheet } from "./rate-item-edit-sheet";
import {
  HOTEL_ID,
  ok,
  RATE_CARD_ID,
  RATE_ITEM_ID,
  rateItemViewFixture,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

interface Captured {
  created?: unknown;
  updated?: unknown;
}

function itemFetch(captured: Captured): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards/${RATE_CARD_ID}/items`]: (init) => {
      captured.created = JSON.parse(String(init?.body));
      return ok(rateItemViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/rate-cards/${RATE_CARD_ID}/items/${RATE_ITEM_ID}`]: (
      init,
    ) => {
      captured.updated = JSON.parse(String(init?.body));
      return ok(rateItemViewFixture());
    },
  });
}

const noop = (): void => {};

describe("RateItemEditSheet", () => {
  it("adds a rate item: the amount and range convert to wire paise", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RateItemEditSheet
        hotelId={HOTEL_ID}
        cardId={RATE_CARD_ID}
        open
        item={null}
        onClose={noop}
      />,
      itemFetch(captured),
    );
    await fireEvent.changeText(await screen.findByTestId("rate-item-amount"), "16000");
    await fireEvent.changeText(screen.getByTestId("rate-item-amount-max"), "24000");
    await fireEvent.press(screen.getByTestId("rate-item-client-visible"));
    await fireEvent.press(screen.getByTestId("rate-item-edit-submit"));
    expect(await screen.findByText("Rate item added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      amount: { minor: 1600000, currency: "INR" },
      amountMax: { minor: 2400000, currency: "INR" },
      clientVisible: true,
    });
  });

  it("blocks submit on a missing amount, then on an upper bound below the amount", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RateItemEditSheet
        hotelId={HOTEL_ID}
        cardId={RATE_CARD_ID}
        open
        item={null}
        onClose={noop}
      />,
      itemFetch(captured),
    );
    await fireEvent.press(await screen.findByTestId("rate-item-edit-submit"));
    expect(await screen.findByText("Enter the amount")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("rate-item-amount"), "20000");
    await fireEvent.changeText(screen.getByTestId("rate-item-amount-max"), "10000");
    await fireEvent.press(screen.getByTestId("rate-item-edit-submit"));
    expect(await screen.findByText("Upper amount must be at least the amount")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a rate item: seeds rupees from the stored paise and patches", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <RateItemEditSheet
        hotelId={HOTEL_ID}
        cardId={RATE_CARD_ID}
        open
        item={rateItemViewFixture()}
        onClose={noop}
      />,
      itemFetch(captured),
    );
    await screen.findByDisplayValue("16000");
    await fireEvent.changeText(screen.getByTestId("rate-item-amount"), "18000");
    await fireEvent.press(screen.getByTestId("rate-item-edit-submit"));
    expect(await screen.findByText("Rate item updated")).toBeOnTheScreen();
    expect(captured.updated).toMatchObject({ amount: { minor: 1800000, currency: "INR" } });
  });
});
