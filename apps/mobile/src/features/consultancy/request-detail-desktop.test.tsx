import type * as ReactModule from "react";

import { act, fireEvent, screen, within } from "../../test/render";
import { renderWithApi } from "../../test/api";
import {
  CLOSED_ENQUIRY,
  CLOSED_ENQUIRY_ID,
  ENQUIRY,
  ENQUIRY_ID,
  enquiryDetailApi as enquiryApi,
  fakeApi,
  ok,
  page,
  PROPOSAL_ID,
} from "./consultancy.fixtures";
import { RequestDetailScreen } from "./request-detail-screen";

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does. Its width picks the layout: the enquiry on its own page
 * below 1024, D8's list beside it from there.
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

async function renderDetail(fetchImpl: typeof fetch): Promise<void> {
  await renderWithApi(<RequestDetailScreen enquiryId={ENQUIRY_ID} />, fetchImpl);
}

beforeEach(() => jest.clearAllMocks());

describe("RequestDetailScreen from 1024 (D8)", () => {
  const LIST = { "GET /consultancy/enquiries": ok(page([CLOSED_ENQUIRY, ENQUIRY])) };

  beforeEach(() => {
    mockWindow.width = 1440;
  });

  it("folds the enquiry into one detail panel beside the list, with every section", async () => {
    await renderDetail(enquiryApi(LIST));
    const detail = await screen.findByTestId("request-detail-panel");
    expect(await within(detail).findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(within(detail).getByText("12–14 FEB 2027 · 300 guests · 80 rooms")).toBeOnTheScreen();
    expect(within(detail).getByLabelText("Your decision, current step")).toBeOnTheScreen();
    expect(within(detail).getByText("Sangeet, wedding, reception")).toBeOnTheScreen();
    expect(within(detail).getByRole("button", { name: "Add a note" })).toBeOnTheScreen();
    expect(await within(detail).findByTestId(`proposal-${PROPOSAL_ID}`)).toBeOnTheScreen();
    expect(within(detail).getByText("Activity")).toBeOnTheScreen();
    expect(within(detail).getByTestId("enquiry-withdraw")).toBeOnTheScreen();
    // One panel, not the phone's separate summary card under a page header.
    expect(screen.queryByTestId("enquiry-summary")).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("sets the proposal's decisions in one row, the gold action at its own width", async () => {
    await renderDetail(enquiryApi(LIST));
    const accept = await screen.findByRole("button", { name: "Accept proposal" });
    expect(accept.props.className).toContain("self-start");
  });

  it("selects this enquiry in the list, stays put on it, and opens another", async () => {
    await renderDetail(enquiryApi(LIST));
    const own = await screen.findByTestId(`request-card-${ENQUIRY_ID}`);
    expect(own).toBeSelected();
    await fireEvent.press(own);
    expect(mockRouter.push).not.toHaveBeenCalled();
    const other = screen.getByTestId(`request-card-${CLOSED_ENQUIRY_ID}`);
    expect(other).not.toBeSelected();
    await fireEvent.press(other);
    expect(mockRouter.push).toHaveBeenCalledWith(`/portal/requests/${CLOSED_ENQUIRY_ID}`);
  });

  it("shows not found beside the list for an enquiry outside the client's reach", async () => {
    await renderDetail(fakeApi(LIST));
    expect(await screen.findByText("Request not found")).toBeOnTheScreen();
    expect(screen.getByTestId("requests-panel")).toBeOnTheScreen();
  });

  it("keeps a note being written when the window crosses 1024, both ways", async () => {
    mockWindow.width = 390;
    await renderDetail(enquiryApi(LIST));
    await fireEvent.press(await screen.findByRole("button", { name: "Add a note" }));
    await fireEvent.changeText(await screen.findByLabelText("Your note"), "Half a thought");
    await resizeTo(1440);
    // The layout did switch: the panel and the list are there, the page header is gone.
    expect(await screen.findByTestId("request-detail-panel")).toBeOnTheScreen();
    expect(await screen.findByTestId("requests-panel")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByLabelText("Your note")).toHaveDisplayValue("Half a thought");
    await resizeTo(390);
    expect(screen.queryByTestId("request-detail-panel")).toBeNull();
    expect(screen.getByLabelText("Your note")).toHaveDisplayValue("Half a thought");
  });

  it("keeps the withdraw confirmation open when the window crosses 1024", async () => {
    await renderDetail(enquiryApi(LIST));
    await fireEvent.press(await screen.findByTestId("enquiry-withdraw"));
    expect(await screen.findByTestId("enquiry-withdraw-sheet-confirm")).toBeOnTheScreen();
    await resizeTo(390);
    expect(await screen.findByTestId("enquiry-summary")).toBeOnTheScreen();
    expect(screen.getByTestId("enquiry-withdraw-sheet-confirm")).toBeOnTheScreen();
  });
});
