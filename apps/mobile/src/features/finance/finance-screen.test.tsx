import type * as ReactModule from "react";

import { act, fireEvent, screen, waitFor, within } from "../../test/render";
import { FinanceScreen } from "./finance-screen";
import { fakeFinanceApi, NISHA_ID, renderWithApi } from "./finance.test-utils";

/**
 * The window, as a store its readers subscribe to, so a resize re-renders what reads the width (a
 * plain width mock would let the React Compiler skip the re-render and pass falsely).
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

async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const row = (name: RegExp) => screen.getByRole("button", { name });
const reportAsks = (asked: readonly string[]) =>
  asked.filter((path) => path.startsWith("/crm/reports/subscriptions"));

describe("FinanceScreen (TW-80 on T11, D-128)", () => {
  beforeEach(() => {
    mockWindow.width = 1440;
  });

  it("gives Finance the awaiting queue beside its payments, the oldest picked for Record payment", async () => {
    const api = fakeFinanceApi({ roles: ["FA"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    expect(await screen.findByText("Prasad & Partner")).toBeOnTheScreen();
    expect(screen.getByText("Nisha & Arjun")).toBeOnTheScreen();
    expect(row(/^Prasad & Partner/)).toBeSelected();
    expect(row(/^Nisha & Arjun/)).not.toBeSelected();
    expect(reportAsks(api.asked)[0]).toContain("status=pending_payment");
    const payments = await screen.findByTestId("finance-payments");
    expect(await within(payments).findByText("Meera & Dev")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("finance-header")).getByText("Record payment"),
    ).toBeOnTheScreen();
  });

  it("records against the picked subscription, naming it, and the queue and payments refresh", async () => {
    const api = fakeFinanceApi({ roles: ["FA"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    await fireEvent.press(await screen.findByRole("button", { name: /^Nisha & Arjun/ }));
    expect(row(/^Nisha & Arjun/)).toBeSelected();
    await fireEvent.press(screen.getByTestId("finance-record-payment"));
    expect(await screen.findByTestId("record-payment-subject")).toHaveTextContent(
      "Nisha & Arjun · Hotel Discovery · ₹50,000",
    );
    await fireEvent.changeText(screen.getByTestId("payment-reference"), "NEFT-0002");
    await fireEvent.press(screen.getByTestId("record-payment-submit"));
    expect(await screen.findByText("Payment recorded")).toBeOnTheScreen();
    expect(api.recorded).toEqual([
      { subscriptionId: NISHA_ID, body: expect.objectContaining({ reference: "NEFT-0002" }) },
    ]);
    // The report and the ledger are asked again: Nisha leaves the queue, her payment heads the panel.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Nisha & Arjun/ })).toBeNull(),
    );
    const payments = screen.getByTestId("finance-payments");
    expect(await within(payments).findByText("Nisha & Arjun")).toBeOnTheScreen();
  });

  it("shows Sales the report without the ledger, and lets Sales record (D-125)", async () => {
    const api = fakeFinanceApi({ roles: ["SM"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    expect(await screen.findByText("Prasad & Partner")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-payments")).toBeNull();
    expect(api.asked.some((path) => path.startsWith("/crm/payments"))).toBe(false);
    expect(screen.getByTestId("finance-record-payment")).toBeOnTheScreen();
  });

  it("lists the active subscriptions with their term, with nothing to record", async () => {
    const api = fakeFinanceApi({ roles: ["FA"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    await screen.findByText("Prasad & Partner");
    await fireEvent.press(screen.getByRole("tab", { name: "Active" }));
    // Meera & Dev is in the payments panel too, so wait for her row's term in the table itself.
    expect(await screen.findByText("15 DEC 2026")).toBeOnTheScreen();
    expect(within(screen.getByTestId("finance-table")).getByText("Meera & Dev")).toBeOnTheScreen();
    expect(reportAsks(api.asked).at(-1)).toContain("status=active");
    expect(screen.queryByTestId("finance-record-payment")).toBeNull();
  });

  it("says when nothing awaits payment, and has nothing for Record payment to act on", async () => {
    const api = fakeFinanceApi({ roles: ["FA"], awaiting: [] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    expect(await screen.findByText("Nothing awaiting payment")).toBeOnTheScreen();
    expect(screen.getByTestId("finance-record-payment")).toBeDisabled();
  });

  it("D-164: runs the report for a custom role granted it, with no system role, and offers no more", async () => {
    const api = fakeFinanceApi({
      roles: [],
      customCapabilities: ["reports.subscription_status_payment_history.read:all"],
    });
    await renderWithApi(<FinanceScreen />, api.fetch);
    expect(await screen.findByText("Prasad & Partner")).toBeOnTheScreen();
    expect(screen.queryByTestId("finance-forbidden")).toBeNull();
    // Neither the ledger nor recording was granted, so neither is offered.
    expect(screen.queryByTestId("finance-payments")).toBeNull();
    expect(screen.queryByTestId("finance-record-payment")).toBeNull();
  });

  it("tells the hotel team the area is not theirs and never runs the report", async () => {
    const api = fakeFinanceApi({ roles: ["HT"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    expect(await screen.findByTestId("finance-forbidden")).toBeOnTheScreen();
    expect(reportAsks(api.asked)).toEqual([]);
    expect(screen.queryByTestId("finance-record-payment")).toBeNull();
  });

  it("stacks on a phone, the payments after the table, and keeps the pick across 1024", async () => {
    mockWindow.width = 390;
    const api = fakeFinanceApi({ roles: ["SA"] });
    await renderWithApi(<FinanceScreen />, api.fetch);
    await fireEvent.press(await screen.findByRole("button", { name: /^Nisha & Arjun/ }));
    expect(screen.getByTestId("data-table-stacked")).toBeOnTheScreen();
    await resizeTo(1440);
    expect(screen.queryByTestId("data-table-stacked")).toBeNull();
    expect(row(/^Nisha & Arjun/)).toBeSelected();
    expect(row(/^Prasad & Partner/)).not.toBeSelected();
    await fireEvent.press(screen.getByTestId("finance-record-payment"));
    expect(await screen.findByTestId("record-payment-subject")).toHaveTextContent(/^Nisha & Arjun/);
  });
});
