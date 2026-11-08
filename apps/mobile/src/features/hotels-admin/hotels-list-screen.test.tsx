import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { HotelsListScreen } from "./hotels-list-screen";
import {
  failure,
  HOTEL_ID,
  hotelStaffViewFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const hotelsFetch = (items = [hotelStaffViewFixture()]): FetchFn =>
  routedFetch({ "/hotels-admin/hotels": () => ok({ items, nextCursor: null }) });

beforeEach(() => {
  mockPush.mockClear();
});

describe("HotelsListScreen", () => {
  it("lists hotels and opens one's photos from its row", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch());
    await fireEvent.press(await screen.findByLabelText(/The Lakeside Palace, active/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/hotels-admin/[hotelId]",
      params: { hotelId: HOTEL_ID },
    });
  });

  it("says when there are no hotels", async () => {
    await renderWithApi(<HotelsListScreen />, hotelsFetch([]));
    expect(await screen.findByText("No hotels yet")).toBeOnTheScreen();
  });

  it("shows the error state when the API fails", async () => {
    await renderWithApi(
      <HotelsListScreen />,
      routedFetch({ "/hotels-admin/hotels": () => failure("internal", 500) }),
    );
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderWithApi(
      <HotelsListScreen />,
      routedFetch({ "/hotels-admin/hotels": () => failure("unauthenticated", 401) }),
    );
    expect(await screen.findByText("Sign in to view the hotel catalogue")).toBeOnTheScreen();
  });
});
