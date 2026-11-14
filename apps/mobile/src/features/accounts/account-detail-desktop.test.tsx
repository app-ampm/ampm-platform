import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { AccountDetailScreen } from "./account-detail-screen";
import {
  ACCOUNT_ID,
  accountDetailViewFixture,
  ok,
  planPublicViewFixture,
  renderWithApi,
  routedFetch,
  staffMeFixture,
  SUBSCRIPTION_ID,
  subscriptionViewFixture,
} from "./accounts.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does (a plain width mock would let the React Compiler skip the
 * re-render and pass falsely).
 */
const mockWindow = { width: 1440, listeners: new Set<() => void>() };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  const subscribe = (listener: () => void) => {
    mockWindow.listeners.add(listener);
    return () => mockWindow.listeners.delete(listener);
  };
  return {
    __esModule: true,
    default: function useMockWindowDimensions() {
      const width = react.useSyncExternalStore(subscribe, () => mockWindow.width);
      return { width, height: 900, scale: 2, fontScale: 1 };
    },
  };
});

/** Resizes the window, telling every component that reads it (a tablet turning, a window resized). */
async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

/** A Super Admin signs: the ledger joins the side column, and Record payment is offered. */
const detailFetch = routedFetch({
  [`/crm/accounts/${ACCOUNT_ID}`]: () =>
    ok(accountDetailViewFixture({ internalNotes: "Prefers calls after 6 pm." })),
  "/crm/subscriptions": () => ok({ items: [subscriptionViewFixture()], nextCursor: null }),
  "/crm/plans": () => ok({ items: [planPublicViewFixture()] }),
  "/me": () => ok(staffMeFixture(["SA"])),
  "/crm/payments": () => ok({ items: [], nextCursor: null }),
});

/** Renders the record and waits for its last query (the Finance ledger) to settle. */
async function renderDetail(): Promise<void> {
  await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, detailFetch);
  expect(await screen.findByText("No payments recorded yet.")).toBeOnTheScreen();
}

beforeEach(() => {
  mockWindow.width = 1440;
});

describe("AccountDetailScreen from 1024 (the T3 pattern)", () => {
  it("sets the record header on its own panel: the name once, its status and the facts line", async () => {
    await renderDetail();
    const header = await screen.findByTestId("account-header");
    expect(await within(header).findByText("The Sharma wedding")).toBeOnTheScreen();
    expect(within(header).getByText("Active")).toBeOnTheScreen();
    expect(within(header).getByText(/^Client account · Priya & Arjun · Added/)).toBeOnTheScreen();
    expect(header.props.className).toContain("rounded-xl");
    expect(screen.getAllByText("The Sharma wedding")).toHaveLength(1);
  });

  it("puts contacts and subscriptions beside the facts, the ledger and the notes", async () => {
    await renderDetail();
    const columns = await screen.findByTestId("account-columns");
    expect(columns.props.className).toContain("flex-row");
    // Tree order is reading order: the main column's sections, then the side column's.
    expect(await screen.findByTestId("account-payments")).toBeOnTheScreen();
    const order = screen
      .getAllByTestId(/^account-(contacts|subscriptions|facts|payments)$/)
      .map((section) => section.props.testID);
    expect(order).toEqual([
      "account-contacts",
      "account-subscriptions",
      "account-facts",
      "account-payments",
    ]);
    expect(screen.getByText("Prefers calls after 6 pm.")).toBeOnTheScreen();
  });

  it("stacks the same sections on a phone, contacts first", async () => {
    mockWindow.width = 390;
    await renderDetail();
    const columns = await screen.findByTestId("account-columns");
    expect(columns.props.className).toContain("flex-col");
    expect(screen.getByTestId("account-contacts")).toBeOnTheScreen();
  });

  it("keeps the record-payment sheet and its typed values when the window crosses 1024", async () => {
    mockWindow.width = 390;
    await renderDetail();
    await fireEvent.press(await screen.findByTestId(`record-payment-${SUBSCRIPTION_ID}`));
    await fireEvent.changeText(await screen.findByTestId("payment-reference"), "UTR-4471");
    await fireEvent.changeText(screen.getByTestId("payment-paid-at"), "2026-11-12");
    await fireEvent.press(screen.getByRole("button", { name: "UPI" }));
    await resizeTo(1440);
    // The layout did switch, and the sheet kept what was typed.
    expect(screen.getByTestId("account-columns").props.className).toContain("flex-row");
    expect(screen.getByTestId("payment-reference")).toHaveDisplayValue("UTR-4471");
    expect(screen.getByTestId("payment-paid-at")).toHaveDisplayValue("2026-11-12");
    expect(screen.getByRole("button", { name: "UPI" })).toBeSelected();
    await resizeTo(390);
    expect(screen.getByTestId("account-columns").props.className).toContain("flex-col");
    expect(screen.getByTestId("payment-reference")).toHaveDisplayValue("UTR-4471");
  });
});
