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
});
