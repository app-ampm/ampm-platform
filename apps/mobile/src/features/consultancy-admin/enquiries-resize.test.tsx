import { useEffect, useState } from "react";
import type * as ReactModule from "react";

import { act, fireEvent, screen, waitFor, within } from "../../test/render";
import {
  ENQUIRY_ID,
  HOTEL_NAME,
  SECOND_ENQUIRY_ID,
  detailFixture,
  eventFixture,
  ok,
  renderWithApi,
  routedFetch,
  workspaceRoutes,
} from "./consultancy-admin.test-utils";
import { StaffEnquiriesListScreen } from "./enquiries-list-screen";
import { StaffEnquiryDetailScreen } from "./enquiry-detail-screen";

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  setParams: jest.fn(),
  dismissTo: jest.fn(),
};
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
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that
 * read the width, as React Native's own hook does. (A plain width mock passes falsely: the compiled
 * components would not re-render.)
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

/** The composition did switch: the queue and the pane from 1024, the page's header below it. */
async function expectDesktop(): Promise<void> {
  expect(await screen.findByTestId("enquiry-queue-panel")).toBeOnTheScreen();
  expect(screen.getByTestId("enquiry-pane")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Back to enquiries")).toBeNull();
}

async function expectPhone(): Promise<void> {
  expect(await screen.findByLabelText("Back to enquiries")).toBeOnTheScreen();
  expect(screen.queryByTestId("enquiry-queue-panel")).toBeNull();
  expect(screen.queryByTestId("enquiry-pane")).toBeNull();
}

const EVENTS = [
  eventFixture({ eventType: "hotel_response", summary: "The lawn is free on the 13th." }),
  eventFixture({
    id: "018f0000-0000-7000-8000-0000000007c2",
    eventType: "negotiation_note",
    summary: "15% off for 60 rooms.",
    internalOnly: true,
  }),
];

async function renderDetail(width: number): Promise<void> {
  mockWindow.width = width;
  const routes = workspaceRoutes(detailFixture({ events: EVENTS }));
  await renderWithApi(<StaffEnquiryDetailScreen enquiryId={ENQUIRY_ID} />, routedFetch(routes));
  await screen.findByText("Booking milestones");
  await screen.findAllByText(HOTEL_NAME);
}

beforeEach(() => jest.clearAllMocks());

describe("The open enquiry across 1024", () => {
  it("keeps a proposal being drafted, both ways", async () => {
    await renderDetail(1440);
    await fireEvent.press(await screen.findByRole("button", { name: "New proposal" }));
    await fireEvent.changeText(screen.getByTestId("proposal-client-total"), "18,50,000");
    await resizeTo(390);
    await expectPhone();
    expect(screen.getByTestId("proposal-client-total")).toHaveDisplayValue("18,50,000");
    await resizeTo(1440);
    await expectDesktop();
    expect(screen.getByTestId("proposal-client-total")).toHaveDisplayValue("18,50,000");
  });

  it("keeps an agreement being drafted, both ways", async () => {
    await renderDetail(1440);
    await fireEvent.press(await screen.findByRole("button", { name: "New agreement" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Rate negotiation" }));
    await fireEvent.changeText(screen.getByTestId("agreement-scope"), "Negotiate room rates");
    await resizeTo(390);
    await expectPhone();
    expect(screen.getByTestId("agreement-scope")).toHaveDisplayValue("Negotiate room rates");
    expect(screen.getByRole("button", { name: "Rate negotiation" })).toBeSelected();
    await resizeTo(1440);
    await expectDesktop();
    expect(screen.getByTestId("agreement-scope")).toHaveDisplayValue("Negotiate room rates");
    expect(screen.getByRole("button", { name: "Rate negotiation" })).toBeSelected();
  });

  it("keeps a site visit being planned, from a phone to a desktop and back", async () => {
    await renderDetail(390);
    await fireEvent.press(await screen.findByRole("button", { name: "New site visit" }));
    await fireEvent.changeText(screen.getByTestId("visit-attendees"), "Couple and planner");
    await resizeTo(1440);
    await expectDesktop();
    expect(screen.getByTestId("visit-attendees")).toHaveDisplayValue("Couple and planner");
    await resizeTo(390);
    await expectPhone();
    expect(screen.getByTestId("visit-attendees")).toHaveDisplayValue("Couple and planner");
  });

  it("keeps a milestone being added, from a phone to a desktop and back", async () => {
    await renderDetail(390);
    await fireEvent.press(await screen.findByRole("button", { name: "New milestone" }));
    await fireEvent.press(screen.getByRole("button", { name: "Advance payment" }));
    await fireEvent.changeText(screen.getByTestId("milestone-amount"), "2,50,000");
    await resizeTo(1440);
    await expectDesktop();
    expect(screen.getByRole("button", { name: "Advance payment" })).toBeSelected();
    expect(screen.getByTestId("milestone-amount")).toHaveDisplayValue("2,50,000");
    await resizeTo(390);
    await expectPhone();
    expect(screen.getByTestId("milestone-amount")).toHaveDisplayValue("2,50,000");
  });

  it("keeps the thread's switch where it was set, both ways", async () => {
    await renderDetail(1440);
    await fireEvent.press(screen.getByRole("tab", { name: "Internal" }));
    expect(screen.queryByText("The lawn is free on the 13th.")).toBeNull();
    await resizeTo(390);
    await expectPhone();
    expect(screen.getByRole("tab", { name: "Internal" })).toBeSelected();
    expect(screen.getByText("15% off for 60 rooms.")).toBeOnTheScreen();
    expect(screen.queryByText("The lawn is free on the 13th.")).toBeNull();
    await resizeTo(1440);
    await expectDesktop();
    expect(screen.getByRole("tab", { name: "Internal" })).toBeSelected();
    expect(screen.queryByText("The lawn is free on the 13th.")).toBeNull();
  });
});

describe("The open enquiry as a route", () => {
  it("keeps a proposal draft while an iPad turns: 1440 → 820 → 1440", async () => {
    await renderDetail(1440);
    await fireEvent.press(await screen.findByRole("button", { name: "New proposal" }));
    await fireEvent.changeText(screen.getByTestId("proposal-client-total"), "18,50,000");
    await resizeTo(820);
    await expectPhone();
    expect(screen.getByTestId("proposal-client-total")).toHaveDisplayValue("18,50,000");
    await resizeTo(1440);
    await expectDesktop();
    expect(screen.getByTestId("proposal-client-total")).toHaveDisplayValue("18,50,000");
  });

  it("opens the first enquiry's page when the queue's page widens past 1024", async () => {
    mockWindow.width = 820;
    await renderWithApi(<StaffEnquiriesListScreen />, routedFetch(workspaceRoutes()));
    expect(await screen.findByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await resizeTo(1180);
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(`/enquiries/${ENQUIRY_ID}`),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("changes the open enquiry in place beside the queue, starting its pane afresh", async () => {
    mockWindow.width = 1440;
    const second = detailFixture({
      id: SECOND_ENQUIRY_ID,
      status: "awaiting_hotel",
      functionsSummary: "Engagement lunch",
    });
    const routes = {
      ...workspaceRoutes(),
      [`GET /consultancy-admin/enquiries/${SECOND_ENQUIRY_ID}`]: () => ok(second),
    };
    // Open the second first, so its record is cached when the selection comes back to it: the
    // pane then has its data at once, and only its key keeps the first one's draft from following.
    await renderWithApi(<SelectionHarness startId={SECOND_ENQUIRY_ID} />, routedFetch(routes));
    expect(
      await within(await screen.findByTestId("enquiry-pane")).findByText("Engagement lunch"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`enquiry-card-${ENQUIRY_ID}`));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ id: ENQUIRY_ID });
    await fireEvent.press(await screen.findByRole("button", { name: "New proposal" }));
    await fireEvent.changeText(screen.getByTestId("proposal-client-total"), "18,50,000");
    await fireEvent.press(screen.getByTestId(`enquiry-card-${SECOND_ENQUIRY_ID}`));
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ id: SECOND_ENQUIRY_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
    const pane = await screen.findByTestId("enquiry-pane");
    expect(await within(pane).findByText("Engagement lunch")).toBeOnTheScreen();
    expect(screen.getByTestId(`enquiry-card-${SECOND_ENQUIRY_ID}`)).toBeSelected();
    // The first enquiry's unsaved draft does not follow into the second.
    expect(screen.queryByTestId("proposal-client-total")).toBeNull();
  });
});

/** An enquiry's route whose id the queue's `setParams` changes, as the router does. */
function SelectionHarness({ startId }: { readonly startId: string }) {
  const [id, setId] = useState(startId);
  useEffect(() => {
    mockRouter.setParams.mockImplementation((params: { readonly id: string }) => setId(params.id));
  }, []);
  return <StaffEnquiryDetailScreen enquiryId={id} />;
}
