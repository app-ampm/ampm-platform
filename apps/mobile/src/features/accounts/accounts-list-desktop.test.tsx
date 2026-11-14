import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { AccountsListScreen } from "./accounts-list-screen";
import { accountViewFixture, ok, renderWithApi, type FetchFn } from "./accounts.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
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

async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const SECOND_ACCOUNT_ID = "018f0000-0000-7000-8000-0000000d0002";

/** Page 1 (one account, more waiting) then page 2 (one more, the end) by cursor. */
const paginatedAccountsFetch = (): FetchFn => (input) => {
  const cursor = new URL(String(input)).searchParams.get("cursor");
  return Promise.resolve(
    ok(
      cursor
        ? {
            items: [
              accountViewFixture({
                id: SECOND_ACCOUNT_ID,
                name: "The Verma wedding",
                status: "prospect",
              }),
            ],
            nextCursor: null,
          }
        : { items: [accountViewFixture()], nextCursor: "cursor-2" },
    ),
  );
};

beforeEach(() => {
  mockPush.mockClear();
  mockWindow.width = 1440;
});

describe("AccountsListScreen from 768", () => {
  it("lists the accounts as a table: client, locations, status and the day added", async () => {
    await renderWithApi(<AccountsListScreen />, paginatedAccountsFetch());
    const table = await screen.findByTestId("accounts-table");
    for (const header of ["Client", "Locations", "Status", "Added"]) {
      expect(within(table).getByText(header)).toBeOnTheScreen();
    }
    expect(within(table).getByText("The Sharma wedding")).toBeOnTheScreen();
    expect(within(table).getByText("Priya & Arjun")).toBeOnTheScreen();
    expect(within(table).getByText("Udaipur, Jaipur")).toBeOnTheScreen();
    expect(within(table).getByText("Active")).toBeOnTheScreen();
    expect(within(table).getByText(/^\d+ NOV 2026$/)).toBeOnTheScreen();
    expect(screen.queryByTestId("accounts-list")).toBeNull();
  });

  it("opens an account from its row", async () => {
    await renderWithApi(<AccountsListScreen />, paginatedAccountsFetch());
    await fireEvent.press(
      await screen.findByRole("button", { name: "The Sharma wedding, active" }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/leads/accounts/[accountId]",
      params: { accountId: accountViewFixture().id },
    });
  });

  it("keeps the rows phones read below 768", async () => {
    mockWindow.width = 390;
    await renderWithApi(<AccountsListScreen />, paginatedAccountsFetch());
    expect(await screen.findByTestId("accounts-list")).toBeOnTheScreen();
    expect(screen.queryByTestId("accounts-table")).toBeNull();
  });

  it("keeps every loaded page when the window crosses 768, both ways", async () => {
    mockWindow.width = 390;
    await renderWithApi(<AccountsListScreen />, paginatedAccountsFetch());
    await fireEvent.press(await screen.findByTestId("accounts-load-more"));
    expect(await screen.findByText("The Verma wedding")).toBeOnTheScreen();
    await resizeTo(1440);
    const table = screen.getByTestId("accounts-table");
    expect(within(table).getByText("The Sharma wedding")).toBeOnTheScreen();
    expect(within(table).getByText("The Verma wedding")).toBeOnTheScreen();
    expect(screen.queryByTestId("accounts-load-more")).toBeNull();
    await resizeTo(390);
    expect(
      within(screen.getByTestId("accounts-list")).getByText("The Verma wedding"),
    ).toBeOnTheScreen();
  });
});
