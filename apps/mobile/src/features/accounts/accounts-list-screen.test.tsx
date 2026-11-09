import { pendingFetch } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { AccountsListScreen } from "./accounts-list-screen";
import {
  ACCOUNT_ID,
  accountViewFixture,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./accounts.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

function accountsFetch(items = [accountViewFixture()]): FetchFn {
  return routedFetch({ "/crm/accounts": () => ok({ items, nextCursor: null }) });
}

const SECOND_ACCOUNT_ID = "018f0000-0000-7000-8000-0000000d0002";

/** Page 1 (one account, more waiting) then page 2 (one more, the end) by cursor. */
const paginatedAccountsFetch = (): FetchFn => (input) => {
  const cursor = new URL(String(input)).searchParams.get("cursor");
  return Promise.resolve(
    ok(
      cursor
        ? {
            items: [accountViewFixture({ id: SECOND_ACCOUNT_ID, name: "The Verma wedding" })],
            nextCursor: null,
          }
        : { items: [accountViewFixture()], nextCursor: "cursor-2" },
    ),
  );
};

describe("AccountsListScreen", () => {
  beforeEach(() => mockPush.mockClear());

  it("shows the loading state", async () => {
    await renderWithApi(<AccountsListScreen />, pendingFetch);
    expect(await screen.findByTestId("accounts-loading")).toBeOnTheScreen();
  });

  it("shows an error with a retry", async () => {
    await renderWithApi(
      <AccountsListScreen />,
      routedFetch({ "/crm/accounts": () => failure("internal", 500) }),
    );
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("shows the empty state when there are no accounts", async () => {
    await renderWithApi(<AccountsListScreen />, accountsFetch([]));
    expect(await screen.findByText("No client accounts yet")).toBeOnTheScreen();
  });

  it("lists accounts and opens one", async () => {
    await renderWithApi(<AccountsListScreen />, accountsFetch());
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    expect(screen.getByText("Active")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`account-row-${ACCOUNT_ID}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/leads/accounts/[accountId]",
      params: { accountId: ACCOUNT_ID },
    });
  });

  it("loads the next page from the footer, appends it, and hides the footer at the end", async () => {
    await renderWithApi(<AccountsListScreen />, paginatedAccountsFetch());
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId("accounts-load-more"));
    expect(await screen.findByText("The Verma wedding")).toBeOnTheScreen();
    expect(screen.getByText("The Sharma wedding")).toBeOnTheScreen();
    expect(screen.queryByTestId("accounts-load-more")).toBeNull();
  });

  it("marks the client count as a floor while more pages wait", async () => {
    await renderWithApi(
      <AccountsListScreen />,
      routedFetch({
        "/crm/accounts": () => ok({ items: [accountViewFixture()], nextCursor: "cursor-2" }),
      }),
    );
    expect(await screen.findByText("Clients · 1+")).toBeOnTheScreen();
  });
});
