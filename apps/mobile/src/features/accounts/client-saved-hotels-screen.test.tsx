import { pendingFetch } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { ClientSavedHotelsScreen } from "./client-saved-hotels-screen";
import {
  ACCOUNT_ID,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  savedHotelStaffFixture,
  type FetchFn,
} from "./accounts.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const OTHER_ACCOUNT_ID = "018f0000-0000-7000-8000-0000000d0020";

function savedFetch(items = [savedHotelStaffFixture()], nextCursor: string | null = null): FetchFn {
  return routedFetch({ "/hotels-admin/saved-hotels": () => ok({ items, nextCursor }) });
}

describe("ClientSavedHotelsScreen", () => {
  beforeEach(() => mockPush.mockClear());

  it("shows the loading state", async () => {
    await renderWithApi(<ClientSavedHotelsScreen />, pendingFetch);
    expect(await screen.findByTestId("client-saved-hotels-loading")).toBeOnTheScreen();
  });

  it("shows an error with a retry", async () => {
    await renderWithApi(
      <ClientSavedHotelsScreen />,
      routedFetch({ "/hotels-admin/saved-hotels": () => failure("internal", 500) }),
    );
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("shows the empty state when no client has saved a hotel", async () => {
    await renderWithApi(<ClientSavedHotelsScreen />, savedFetch([]));
    expect(await screen.findByText("No saved hotels yet")).toBeOnTheScreen();
  });

  it("lists every client's saves with the client, hotel, note and day, and opens the client", async () => {
    const other = savedHotelStaffFixture({
      id: "018f0000-0000-7000-8000-0000000d0021",
      account: { id: OTHER_ACCOUNT_ID, name: "The Verma wedding" },
      note: null,
    });
    await renderWithApi(<ClientSavedHotelsScreen />, savedFetch([savedHotelStaffFixture(), other]));
    expect(await screen.findByText("The Sharma wedding")).toBeOnTheScreen();
    expect(screen.getByText("The Verma wedding")).toBeOnTheScreen();
    expect(screen.getByText("“Loved the lake-facing lawn”")).toBeOnTheScreen();
    expect(screen.getByText("Hotels saved · 2")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("The Sharma wedding"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/leads/accounts/[accountId]",
      params: { accountId: ACCOUNT_ID },
    });
  });

  it("marks the count as a floor while more pages wait", async () => {
    await renderWithApi(<ClientSavedHotelsScreen />, savedFetch(undefined, "cursor-2"));
    expect(await screen.findByText("Hotels saved · 1+")).toBeOnTheScreen();
    expect(screen.getByTestId("client-saved-hotels-load-more")).toBeOnTheScreen();
  });
});
