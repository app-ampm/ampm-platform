import type * as ReactModule from "react";
import type { ReactNode } from "react";
import { Text } from "react-native";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import { renderWithApi } from "../../test/api";
import {
  CLOSED_ENQUIRY,
  CLOSED_ENQUIRY_ID,
  ENQUIRY,
  ENQUIRY_DETAIL,
  ENQUIRY_ID,
  fail,
  fakeApi,
  HOTEL,
  HOTEL_ID,
  ok,
  page,
  PROPOSAL_ID,
  SHARED_PROPOSAL,
} from "./consultancy.fixtures";
import { RequestsListScreen } from "./requests-list-screen";

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

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

/** The API behind D8 on a desktop: the list (newest first), and the newest with a shared proposal. */
function desktopApi(): typeof fetch {
  return fakeApi({
    "GET /consultancy/enquiries": ok(page([ENQUIRY, CLOSED_ENQUIRY])),
    [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
    [`GET /consultancy/enquiries/${ENQUIRY_ID}`]: ok(ENQUIRY_DETAIL),
    [`GET /consultancy/enquiries/${ENQUIRY_ID}/proposals`]: ok(page([SHARED_PROPOSAL])),
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

  it("puts the list panel beside the most recent enquiry, without changing the address", async () => {
    await renderList(desktopApi());
    const detail = await screen.findByTestId("request-detail-panel");
    expect(await within(detail).findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(await within(detail).findByTestId(`proposal-${PROPOSAL_ID}`)).toBeOnTheScreen();
    expect(within(screen.getByTestId("requests-panel")).getByText("Enquiries")).toBeOnTheScreen();
    // Both panels run to the taller one's foot, as D8's grid row does.
    expect(screen.getByTestId("requests-split").props.className).toContain("items-stretch");
    // The title moved into the panel: no page header, so no back button.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("marks the open enquiry selected, and opens another at its own address", async () => {
    await renderList(desktopApi());
    const open = await screen.findByTestId(`request-card-${ENQUIRY_ID}`);
    expect(open).toBeSelected();
    expect(open.props.className).toContain("bg-highlight/10");
    const other = screen.getByTestId(`request-card-${CLOSED_ENQUIRY_ID}`);
    expect(other).not.toBeSelected();
    await fireEvent.press(other);
    expect(mockRouter.push).toHaveBeenCalledWith(`/portal/requests/${CLOSED_ENQUIRY_ID}`);
  });

  it("stays put when the auto-opened enquiry's own card is pressed", async () => {
    await renderList(desktopApi());
    const open = await screen.findByTestId(`request-card-${ENQUIRY_ID}`);
    expect(open).toBeSelected();
    await fireEvent.press(open);
    // No second entry for the same enquiry, and no rebuilt screen.
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("request-detail-panel")).toBeOnTheScreen();
  });

  it("shows the list's loading rows in the panel, and the enquiry's skeleton beside them", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    const panel = screen.getByTestId("requests-panel");
    expect(within(panel).getByTestId("requests-loading")).toBeOnTheScreen();
    expect(screen.getByTestId("request-detail-loading")).toBeOnTheScreen();
  });

  it("keeps the empty state and its gold action in the list panel", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": ok(page([])) }));
    const panel = await screen.findByTestId("requests-panel");
    expect(await within(panel).findByText("No hotel requests yet")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-detail-panel")).toBeNull();
    await fireEvent.press(within(panel).getByRole("button", { name: "Browse hotels" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/hotels");
  });
});
