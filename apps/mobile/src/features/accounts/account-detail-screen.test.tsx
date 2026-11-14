import type { SubscriptionView } from "@ampm/core";

import { act, fireEvent, screen, within } from "../../test/render";
import { AccountDetailScreen } from "./account-detail-screen";
import {
  ACCOUNT_ID,
  accountDetailViewFixture,
  failure,
  ok,
  PAYMENT_ID,
  paymentFinanceViewFixture,
  planPublicViewFixture,
  renderWithApi,
  routedFetch,
  staffMeFixture,
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

type Roles = ReturnType<typeof staffMeFixture>["roles"];

function detailFetch(
  captured: Captured,
  subscriptions = [subscriptionViewFixture()],
  roles: Roles = ["SM"],
): FetchFn {
  return routedFetch({
    [`/crm/accounts/${ACCOUNT_ID}`]: () => ok(accountDetailViewFixture()),
    "/crm/subscriptions": () => ok({ items: subscriptions, nextCursor: null }),
    "/crm/plans": () => ok({ items: [planPublicViewFixture()] }),
    // Sales (crm.subscriptions.update, no crm.payments.read) signs these tests unless one names
    // other roles; the Finance payment ledger stays hidden.
    "/me": () => ok(staffMeFixture(roles)),
    [`/crm/subscriptions/${SUBSCRIPTION_ID}/record-payment`]: (init) => {
      captured.payment = JSON.parse(String(init?.body));
      return ok(subscriptionViewFixture({ status: "active" }));
    },
  });
}

/** A detail fetch signed by the given roles, with the account's payment ledger answered. */
function ledgerFetch(roles: ReturnType<typeof staffMeFixture>["roles"]): FetchFn {
  return routedFetch({
    [`/crm/accounts/${ACCOUNT_ID}`]: () => ok(accountDetailViewFixture()),
    "/crm/subscriptions": () => ok({ items: [], nextCursor: null }),
    "/crm/plans": () => ok({ items: [planPublicViewFixture()] }),
    "/me": () => ok(staffMeFixture(roles)),
    "/crm/payments": () => ok({ items: [paymentFinanceViewFixture()], nextCursor: null }),
  });
}

const SECOND_PAYMENT_ID = "018f0000-0000-7000-8000-0000000e0002";
const SECOND_SUBSCRIPTION_ID = "018f0000-0000-7000-8000-0000000e0003";

/** A Finance ledger whose payments paginate: page 1 (more waiting) then page 2 (the end) by cursor. */
const paginatedLedgerFetch = (): FetchFn => (input) => {
  const url = new URL(String(input));
  if (url.pathname === `/crm/accounts/${ACCOUNT_ID}`) {
    return Promise.resolve(ok(accountDetailViewFixture()));
  }
  if (url.pathname === "/crm/subscriptions")
    return Promise.resolve(ok({ items: [], nextCursor: null }));
  if (url.pathname === "/crm/plans")
    return Promise.resolve(ok({ items: [planPublicViewFixture()] }));
  if (url.pathname === "/me") return Promise.resolve(ok(staffMeFixture(["FA"])));
  if (url.pathname === "/crm/payments") {
    const cursor = url.searchParams.get("cursor");
    return Promise.resolve(
      ok(
        cursor
          ? { items: [paymentFinanceViewFixture({ id: SECOND_PAYMENT_ID })], nextCursor: null }
          : { items: [paymentFinanceViewFixture()], nextCursor: "p2" },
      ),
    );
  }
  return Promise.resolve(failure("not_found", 404));
};

describe("AccountDetailScreen", () => {
  it("shows the account, its contact and the subscription with the plan price", async () => {
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, detailFetch({}));
    // The screen fans out three independent queries (account, plans, subscriptions); await each
    // one's content rather than reading it synchronously off the first to resolve.
    expect(await screen.findByText(/Client account · Priya & Arjun · Added/)).toBeOnTheScreen();
    // The name reads once, as the record header's title; no second overview card repeats it.
    expect(screen.getAllByText("The Sharma wedding")).toHaveLength(1);
    expect(screen.getByText("Udaipur, Jaipur")).toBeOnTheScreen();
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

  it("puts Record payment in the header while one subscription waits, not on its row", async () => {
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, detailFetch({}));
    const header = await screen.findByTestId("account-header");
    expect(
      await within(header).findByTestId(`record-payment-${SUBSCRIPTION_ID}`),
    ).toBeOnTheScreen();
    expect(within(header).getByText("Active")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: "Record payment" })).toHaveLength(1);
  });

  it("keeps Record payment on each row when several subscriptions wait", async () => {
    const second = subscriptionViewFixture({ id: SECOND_SUBSCRIPTION_ID });
    await renderWithApi(
      <AccountDetailScreen accountId={ACCOUNT_ID} />,
      detailFetch({}, [subscriptionViewFixture(), second]),
    );
    expect(await screen.findByTestId(`record-payment-${SECOND_SUBSCRIPTION_ID}`)).toBeOnTheScreen();
    const subscriptions = screen.getByTestId("account-subscriptions");
    expect(
      within(subscriptions).getByTestId(`record-payment-${SUBSCRIPTION_ID}`),
    ).toBeOnTheScreen();
    const header = screen.getByTestId("account-header");
    expect(within(header).queryByRole("button", { name: "Record payment" })).toBeNull();
  });

  describe("Record payment follows crm.subscriptions.update, the key the route requires", () => {
    const second = subscriptionViewFixture({ id: SECOND_SUBSCRIPTION_ID });

    /** Renders the record and lets every query, `/me` with them, answer before a check for absence. */
    async function renderSettled(subscriptions: SubscriptionView[], roles: Roles): Promise<void> {
      await renderWithApi(
        <AccountDetailScreen accountId={ACCOUNT_ID} />,
        detailFetch({}, subscriptions, roles),
      );
      expect(await screen.findAllByText("Pending payment")).toHaveLength(subscriptions.length);
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    }

    it.each([
      ["one waits", [subscriptionViewFixture()]],
      ["several wait", [subscriptionViewFixture(), second]],
    ])("hides it from a reader without the key when %s", async (_, subscriptions) => {
      // The hotel team (HT) reads subscriptions but may not update them.
      await renderSettled(subscriptions, ["HT"]);
      expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();
      expect(screen.queryByTestId(`record-payment-${SUBSCRIPTION_ID}`)).toBeNull();
    });

    it.each([
      ["one waits", [subscriptionViewFixture()], 1],
      ["several wait", [subscriptionViewFixture(), second], 2],
    ])("offers it to a reader with the key when %s", async (_, subscriptions, count) => {
      await renderSettled(subscriptions, ["SM"]);
      expect(screen.getAllByRole("button", { name: "Record payment" })).toHaveLength(count);
    });
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
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("shows the finance payment ledger to a role that holds crm.payments.read", async () => {
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, ledgerFetch(["FA"]));
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    expect(await screen.findByTestId("account-payments")).toBeOnTheScreen();
    expect(await screen.findByTestId(`payment-${PAYMENT_ID}`)).toBeOnTheScreen();
    expect(screen.getByText("Inbound")).toBeOnTheScreen();
    expect(screen.getByText(/25,000/)).toBeOnTheScreen();
  });

  it("loads more payments from the ledger footer and hides it at the end", async () => {
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, paginatedLedgerFetch());
    expect(await screen.findByTestId(`payment-${PAYMENT_ID}`)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId("payments-load-more"));
    expect(await screen.findByTestId(`payment-${SECOND_PAYMENT_ID}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`payment-${PAYMENT_ID}`)).toBeOnTheScreen();
    expect(screen.queryByTestId("payments-load-more")).toBeNull();
  });

  it("hides the finance ledger from a role without the key and never queries it", async () => {
    const paths: string[] = [];
    const base = ledgerFetch(["SM"]);
    const spyFetch: FetchFn = (input, init) => {
      paths.push(String(input));
      return base(input, init);
    };
    await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, spyFetch);
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    // /me is read (the gate needs the role), but the RESTRICTED-FINANCE ledger is neither shown nor fetched.
    await screen.findByText("Subscriptions");
    expect(paths.some((p) => p.includes("/me"))).toBe(true);
    expect(screen.queryByTestId("account-payments")).toBeNull();
    expect(paths.some((p) => p.includes("/crm/payments"))).toBe(false);
  });
});
