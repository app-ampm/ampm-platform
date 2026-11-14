import type * as ReactModule from "react";

import { fireEvent, screen, waitFor, within } from "../../test/render";
import {
  CLIENT_NAME,
  ENQUIRY_ID,
  HOTEL_ID,
  HOTEL_NAME,
  SECOND_ENQUIRY_ID,
  detailFixture,
  eventFixture,
  failure,
  page,
  renderWithApi,
  routedFetch,
  workspaceRoutes,
  type SentRequest,
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
 * The window, as a store its readers subscribe to (as React Native's own hook is): its width picks
 * the composition, the queue beside the enquiry from 1024, one at a time below.
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

const EVENTS = [
  eventFixture({ eventType: "hotel_response", summary: "The lawn is free on the 13th." }),
];
const LIST = "GET /consultancy-admin/enquiries";

/** Waits until the enquiry, its sections and its names have all arrived, so nothing lands later. */
async function settled(): Promise<void> {
  await screen.findByText("Booking milestones");
  await screen.findAllByText(HOTEL_NAME);
  await screen.findAllByText(new RegExp(CLIENT_NAME, "i"));
}

async function renderList(routes = workspaceRoutes(), sent: SentRequest[] = []): Promise<void> {
  await renderWithApi(<StaffEnquiriesListScreen />, routedFetch(routes, sent));
}

async function renderDetail(sent: SentRequest[] = []): Promise<void> {
  const routes = workspaceRoutes(detailFixture({ events: EVENTS }));
  await renderWithApi(
    <StaffEnquiryDetailScreen enquiryId={ENQUIRY_ID} />,
    routedFetch(routes, sent),
  );
  await settled();
}

const isText = (child: unknown): child is string => typeof child === "string";

/** The words of every heading inside an element, in reading order. */
function headings(container: Parameters<typeof within>[0]): string[] {
  return within(container)
    .getAllByRole("header")
    .map((heading) => [heading.props.children].flat().filter(isText).join(""));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.width = 1440;
});

describe("The queue's page from 1024 (T6)", () => {
  it("is replaced by the first enquiry's page once the queue has loaded", async () => {
    await renderList();
    const queue = await screen.findByTestId("enquiry-queue-panel");
    expect(await within(queue).findByText("2 open")).toBeOnTheScreen();
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(`/enquiries/${ENQUIRY_ID}`),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
    // Until that page arrives, the pane holds the enquiry's shapes; nothing is selected yet.
    expect(screen.getByTestId("staff-enquiry-loading")).toBeOnTheScreen();
    expect(screen.getByTestId(`enquiry-card-${ENQUIRY_ID}`)).not.toBeSelected();
    expect(screen.queryByLabelText("Back to enquiries")).toBeNull();
  });

  it("says nothing is open beside an empty queue, and opens nothing", async () => {
    await renderList({ [LIST]: () => page([]) });
    expect(await screen.findByText("No hotel enquiries yet")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("enquiry-none-open")).getByText("No enquiry open"),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("staff-enquiry-loading")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("says nothing can open beside a queue that failed to load", async () => {
    await renderList({ [LIST]: () => failure("internal", 500) });
    expect(
      await screen.findByText("Nothing can open here until the queue loads."),
    ).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("loads the queue and the enquiry in their own panels", async () => {
    await renderWithApi(<StaffEnquiriesListScreen />, () => new Promise<Response>(() => {}));
    const queue = screen.getByTestId("enquiry-queue-panel");
    expect(within(queue).getByTestId("staff-enquiries-loading")).toBeOnTheScreen();
    expect(screen.getByTestId("staff-enquiry-loading")).toBeOnTheScreen();
  });

  it("shows the queue alone on a phone's page, opening nothing and pushing a tapped row", async () => {
    mockWindow.width = 390;
    const sent: SentRequest[] = [];
    await renderList(workspaceRoutes(), sent);
    expect(await screen.findByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    expect(screen.queryByTestId("enquiry-queue-panel")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(sent.map((request) => request.path)).not.toContain(
      `/consultancy-admin/enquiries/${ENQUIRY_ID}`,
    );
    await fireEvent.press(screen.getByText("Sangeet, wedding and reception"));
    expect(mockRouter.push).toHaveBeenCalledWith(`/enquiries/${ENQUIRY_ID}`);
  });
});

describe("An enquiry's page from 1024 (T6)", () => {
  it("changes the selection in place: setParams, never a new screen", async () => {
    await renderDetail();
    const own = screen.getByTestId(`enquiry-card-${ENQUIRY_ID}`);
    expect(own).toBeSelected();
    await fireEvent.press(own);
    expect(mockRouter.setParams).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(`enquiry-card-${SECOND_ENQUIRY_ID}`));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ id: SECOND_ENQUIRY_ID });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("marks the open card with a word as well as its colour", async () => {
    await renderDetail();
    const own = screen.getByTestId(`enquiry-card-${ENQUIRY_ID}`);
    expect(within(own).getByText("Viewing")).toBeOnTheScreen();
    expect(own).toHaveProp("aria-current", "true");
    const other = screen.getByTestId(`enquiry-card-${SECOND_ENQUIRY_ID}`);
    expect(within(other).queryByText("Viewing")).toBeNull();
  });

  it("titles each card from the queue's own page, asking for no names per card", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(sent);
    const card = screen.getByTestId(`enquiry-card-${ENQUIRY_ID}`);
    expect(within(card).getByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    expect(within(card).getByText("300 guests · submitted 3 Nov 2026")).toBeOnTheScreen();
    expect(within(card).getByText("12–14 FEB 2027")).toBeOnTheScreen();
    expect(within(card).getByText("Submitted")).toBeOnTheScreen();
    expect(within(card).getByText("Unassigned")).toBeOnTheScreen();
    expect(within(card).queryByText(HOTEL_NAME)).toBeNull();
    const other = screen.getByTestId(`enquiry-card-${SECOND_ENQUIRY_ID}`);
    expect(other).toHaveAccessibleName(/^Engagement lunch, Awaiting hotel, 80 guests/);
    // One hotel and one account read, for the open enquiry's header; none for the other card.
    const names = sent.filter((request) =>
      /^\/(hotels-admin\/hotels|crm\/accounts)\//.test(request.path),
    );
    expect(names.map((request) => request.path)).toEqual(
      expect.arrayContaining([`/hotels-admin/hotels/${HOTEL_ID}`]),
    );
    expect(names).toHaveLength(2);
  });

  it("heads the pane with the client and stay as data, the hotel, and the chips", async () => {
    await renderDetail();
    const heading = within(screen.getByTestId("enquiry-pane")).getByTestId("enquiry-heading");
    expect(within(heading).getByText(HOTEL_NAME)).toBeOnTheScreen();
    expect(
      within(heading).getByText(`${CLIENT_NAME.toUpperCase()} · 12–14 FEB 2027 · 300 GUESTS`),
    ).toBeOnTheScreen();
    expect(within(heading).getByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    expect(within(heading).getByLabelText("Submitted")).toBeOnTheScreen();
    expect(within(heading).getByText("Unassigned")).toBeOnTheScreen();
  });

  it("sets the pane's sections in T6's order: the thread, the proposals, then the pipeline", async () => {
    await renderDetail();
    expect(headings(screen.getByTestId("enquiry-pane"))).toEqual([
      HOTEL_NAME,
      "Activity",
      "Proposals",
      "Advance",
      "Service agreements",
      "Site visits",
      "Booking milestones",
    ]);
    // The thread's rows sit straight on the pane's glass: its frame draws nothing.
    expect(screen.getByTestId("enquiry-activity").props.className).toContain("border-0");
  });

  it("keeps the same order on a phone, under the page's header, whose back goes to the queue", async () => {
    mockWindow.width = 390;
    await renderDetail();
    expect(screen.queryByTestId("enquiry-queue-panel")).toBeNull();
    expect(screen.queryByTestId("enquiry-pane")).toBeNull();
    expect(headings(screen.getByTestId("enquiries-split"))).toEqual([
      "Activity",
      "Proposals",
      "Advance",
      "Service agreements",
      "Site visits",
      "Booking milestones",
    ]);
    // Each section stands on the page as its own glass card.
    expect(screen.getByTestId("enquiry-activity").props.className).toContain("border-primary/16");
    await fireEvent.press(screen.getByLabelText("Back to enquiries"));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/enquiries");
  });
});
