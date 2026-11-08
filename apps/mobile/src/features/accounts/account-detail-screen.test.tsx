import { fireEvent, screen } from "../../test/render";
import { AccountDetailScreen } from "./account-detail-screen";
import {
  ACCOUNT_ID,
  accountDetailViewFixture,
  failure,
  ok,
  planPublicViewFixture,
  renderWithApi,
  routedFetch,
  SUBSCRIPTION_ID,
  subscriptionViewFixture,
  type FetchFn,
} from "./accounts.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

interface Captured {
  payment?: unknown;
}

function detailFetch(captured: Captured, subscriptions = [subscriptionViewFixture()]): FetchFn {
  return routedFetch({
    [`/crm/accounts/${ACCOUNT_ID}`]: () => ok(accountDetailViewFixture()),
    "/crm/subscriptions": () => ok({ items: subscriptions, nextCursor: null }),
    "/crm/plans": () => ok({ items: [planPublicViewFixture()] }),
    [`/crm/subscriptions/${SUBSCRIPTION_ID}/record-payment`]: (init) => {
      captured.payment = JSON.parse(String(init?.body));
      return ok(subscriptionViewFixture({ status: "active" }));
    },
  });
}

describe("AccountDetailScreen", () => {
  it("shows the account, its contact and the subscription with the plan price", async () => {
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, detailFetch({}));
    // The screen fans out three independent queries (account, plans, subscriptions); await each
    // one's content rather than reading it synchronously off the first to resolve.
    expect(await screen.findByText("Priya & Arjun")).toBeOnTheScreen();
    expect(screen.getByText("Priya Sharma")).toBeOnTheScreen();
    expect(await screen.findByText("Hotel discovery")).toBeOnTheScreen();
    expect(await screen.findByText(/25,000/)).toBeOnTheScreen();
    expect(await screen.findByText("Pending payment")).toBeOnTheScreen();
  });

  it("records a manual payment on a pending subscription", async () => {
    const captured: Captured = {};
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, detailFetch(captured));
    await fireEvent.press(await screen.findByTestId(`record-payment-${SUBSCRIPTION_ID}`));
    await fireEvent.changeText(await screen.findByTestId("payment-reference"), "UTR-99");
    await fireEvent.press(screen.getByTestId("record-payment-submit"));
    expect(await screen.findByText("Payment recorded")).toBeOnTheScreen();
    expect(captured.payment).toMatchObject({ reference: "UTR-99", method: "bank_transfer" });
  });

  it("blocks recording a payment without a reference", async () => {
    const captured: Captured = {};
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, detailFetch(captured));
    await fireEvent.press(await screen.findByTestId(`record-payment-${SUBSCRIPTION_ID}`));
    await fireEvent.press(await screen.findByTestId("record-payment-submit"));
    expect(await screen.findByText("Enter the payment reference")).toBeOnTheScreen();
    expect(captured.payment).toBeUndefined();
  });

  it("surfaces a failed subscriptions load instead of a blank section", async () => {
    const fetch = routedFetch({
      [`/crm/accounts/${ACCOUNT_ID}`]: () => ok(accountDetailViewFixture()),
      "/crm/subscriptions": () => failure("internal", 500),
      "/crm/plans": () => ok({ items: [planPublicViewFixture()], nextCursor: null }),
    });
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, fetch);
    expect(await screen.findByText("Priya & Arjun")).toBeOnTheScreen();
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });
});
