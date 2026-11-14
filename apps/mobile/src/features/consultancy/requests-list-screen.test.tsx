import type * as ReactModule from "react";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { uiCopy } from "@ampm/ui";

import { act, fireEvent, screen, waitFor, within } from "../../test/render";
import { renderWithApi } from "../../test/api";
import {
  CLOSED_ENQUIRY,
  CLOSED_ENQUIRY_ID,
  ENQUIRY,
  ENQUIRY_ID,
  fail,
  fakeApi,
  HOTEL,
  HOTEL_ID,
  ok,
  page,
} from "./consultancy.fixtures";
import { RequestsListScreen } from "./requests-list-screen";

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn() };

jest.mock("expo-router", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  return {
    useRouter: () => mockRouter,
    // The screen under test is the focused one: its focus effect runs as an effect does.
    useFocusEffect: function useMockFocusEffect(effect: () => void) {
      react.useEffect(effect, [effect]);
    },
  };
});

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does. Its width picks the layout: the list on its own page below
 * 1024, D8's list beside the open enquiry from there.
 */
const mockWindow = { width: 390, listeners: new Set<() => void>() };
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

async function renderList(fetchImpl: typeof fetch, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<RequestsListScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 390;
});

/** The API behind D8's list on a desktop: the enquiries, newest first, and their hotel. */
function desktopApi(): typeof fetch {
  return fakeApi({
    "GET /consultancy/enquiries": ok(page([ENQUIRY, CLOSED_ENQUIRY])),
    [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
  });
}

describe("RequestsListScreen", () => {
  it("shows the loading panel while the enquiries are pending", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByText("Enquiries")).toBeOnTheScreen();
    expect(screen.getByTestId("requests-loading")).toBeOnTheScreen();
  });

  it("lists each enquiry with its hotel, stay, party and a status chip", async () => {
    await renderList(
      fakeApi({
        "GET /consultancy/enquiries": ok(page([ENQUIRY, CLOSED_ENQUIRY])),
        [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
      }),
    );
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(screen.getByText("12–14 Feb 2027")).toBeOnTheScreen();
    expect(screen.getByText("300 guests")).toBeOnTheScreen();
    expect(screen.getByText("Your decision")).toBeOnTheScreen();
    // The second hotel is out of reach (404): the row keeps its generic title, and says how it closed.
    expect(screen.getByText("Hotel request")).toBeOnTheScreen();
    expect(screen.getByText("28 Feb – 2 Mar 2027")).toBeOnTheScreen();
    expect(screen.getByText("1 guest")).toBeOnTheScreen();
    expect(screen.getByText("Not available")).toBeOnTheScreen();
  });

  it("opens an enquiry when its row is pressed", async () => {
    await renderList(
      fakeApi({
        "GET /consultancy/enquiries": ok(page([ENQUIRY])),
        [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
      }),
    );
    const row = await screen.findByRole("button", {
      name: "The Lake Pavilion, Your decision, 12–14 Feb 2027, 300 guests",
    });
    await fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenCalledWith(`/portal/requests/${ENQUIRY_ID}`);
  });

  it("offers to browse hotels when there are no requests yet", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": ok(page([])) }));
    expect(await screen.findByText("No hotel requests yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Browse hotels" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/hotels");
  });

  it("shows the offline state on a network failure", async () => {
    await renderList(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("asks the person to sign in when the session is missing", async () => {
    await renderList(
      fakeApi({ "GET /consultancy/enquiries": fail(401, "unauthenticated", "Sign in") }),
    );
    expect(await screen.findByText("Sign in to view your requests")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the retryable error state when the list fails", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": fail(500, "internal") }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("draws the tab bar the route supplies, and goes back from its header", async () => {
    await renderList(() => new Promise<Response>(() => {}), <Text testID="tab-bar">Tabs</Text>);
    expect(screen.getByTestId("tab-bar")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe("RequestsListScreen from 1024 (D8)", () => {
  beforeEach(() => {
    mockWindow.width = 1440;
  });

  it("is replaced by the most recent enquiry's page once the list has loaded", async () => {
    await renderList(desktopApi());
    const panel = await screen.findByTestId("requests-panel");
    expect(within(panel).getByText("Enquiries")).toBeOnTheScreen();
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(`/portal/requests/${ENQUIRY_ID}`),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    // Until that page arrives, the enquiry's shapes stand beside the list; nothing is selected yet.
    expect(screen.getByTestId("request-detail-loading")).toBeOnTheScreen();
    expect(await screen.findByTestId(`request-card-${ENQUIRY_ID}`)).not.toBeSelected();
    // Both panels run to the taller one's foot, as D8's grid row does.
    expect(screen.getByTestId("requests-split").props.className).toContain("items-stretch");
    // The title moved into the panel: no page header, so no back button.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("opens a pressed card's enquiry in place of the list's page", async () => {
    await renderList(desktopApi());
    await fireEvent.press(await screen.findByTestId(`request-card-${CLOSED_ENQUIRY_ID}`));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/portal/requests/${CLOSED_ENQUIRY_ID}`);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("opens the most recent enquiry's page when the list's page widens past 1024", async () => {
    mockWindow.width = 820;
    await renderList(desktopApi());
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(() => {
      mockWindow.width = 1180;
      mockWindow.listeners.forEach((listener) => listener());
    });
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(`/portal/requests/${ENQUIRY_ID}`),
    );
  });

  it("shows the list's loading rows in the panel, and the enquiry's skeleton beside them", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    const panel = screen.getByTestId("requests-panel");
    expect(within(panel).getByTestId("requests-loading")).toBeOnTheScreen();
    expect(screen.getByTestId("request-detail-loading")).toBeOnTheScreen();
  });

  it("keeps the empty state and its gold action in the list panel, nothing open beside it", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": ok(page([])) }));
    const panel = await screen.findByTestId("requests-panel");
    expect(await within(panel).findByText("No hotel requests yet")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("request-none-open")).getByText("No request open"),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("request-detail-loading")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(within(panel).getByRole("button", { name: "Browse hotels" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/hotels");
  });

  it("says nothing can open beside a list that failed to load", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": fail(500, "internal") }));
    expect(
      await screen.findByText("Nothing can open here until your requests load."),
    ).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
