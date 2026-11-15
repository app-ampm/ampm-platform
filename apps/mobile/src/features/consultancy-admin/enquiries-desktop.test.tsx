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

/** Waits until the enquiry, its client account and the stage counts have arrived, so nothing lands later. */
async function settled(): Promise<void> {
  await screen.findAllByText(HOTEL_NAME);
  await screen.findByText("Open client account");
  // The stage counts arrive with the queue's panel, which a phone's enquiry page does not have.
  if (screen.queryByTestId("enquiry-queue-panel")) await screen.findByText("Proposal v2 · shared");
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
    expect(await screen.findByText(CLIENT_NAME)).toBeOnTheScreen();
    expect(screen.queryByTestId("enquiry-queue-panel")).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(sent.map((request) => request.path)).not.toContain(
      `/consultancy-admin/enquiries/${ENQUIRY_ID}`,
    );
    await fireEvent.press(screen.getByText(CLIENT_NAME));
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

  it("leads each card with the client, from the queue's own page, asking for no names per card", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(sent);
    const card = screen.getByTestId(`enquiry-card-${ENQUIRY_ID}`);
    expect(within(card).getByText(CLIENT_NAME)).toBeOnTheScreen();
    expect(within(card).getByText(`${HOTEL_NAME} · 12–14 Feb 2027`)).toBeOnTheScreen();
    expect(within(card).getByText("300 guests · submitted 3 Nov 2026")).toBeOnTheScreen();
    expect(within(card).getByText("Submitted")).toBeOnTheScreen();
    expect(within(card).getByText("Unassigned")).toBeOnTheScreen();
    const other = screen.getByTestId(`enquiry-card-${SECOND_ENQUIRY_ID}`);
    expect(within(other).getByText("Proposal v2 · shared")).toBeOnTheScreen();
    expect(other).toHaveAccessibleName(
      /^Kapoor family, Awaiting hotel, Rose Fort Palace · 12–14 Feb 2027, 80 guests/,
    );
    // The names come with the queue: no hotel read at all, and one account read, for the open
    // enquiry's contacts; none for the other card.
    const names = sent.filter((request) =>
      /^\/(hotels-admin\/hotels|crm\/accounts)\//.test(request.path),
    );
    expect(names.map((request) => request.path)).not.toContain(`/hotels-admin/hotels/${HOTEL_ID}`);
    expect(names).toHaveLength(1);
  });

  it("filters the queue by stage beside the open enquiry, which stays open", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(sent);
    const queue = screen.getByTestId("enquiry-queue-panel");
    await fireEvent.press(within(queue).getByRole("button", { name: /^With hotel/ }));
    expect(within(queue).getByRole("button", { name: /^With hotel/ })).toBeSelected();
    expect(screen.getByTestId("enquiry-pane")).toBeOnTheScreen();
    expect(mockRouter.setParams).not.toHaveBeenCalled();
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

  it("frames the pane as header, pipeline and tabs, each tab holding its own sections", async () => {
    await renderDetail();
    const pane = screen.getByTestId("enquiry-pane");
    expect(within(pane).getByTestId("enquiry-pipeline")).toBeOnTheScreen();
    // The overview: the client card's name, then the status moves.
    expect(headings(pane)).toEqual([HOTEL_NAME, CLIENT_NAME, "Move the enquiry"]);
    await fireEvent.press(within(pane).getByRole("tab", { name: "Booking" }));
    // Past the sections' loading shapes (which carry the same titles) to the loaded sections.
    expect(
      await within(pane).findByText("No milestone yet. Add them once the hotel holds the dates."),
    ).toBeOnTheScreen();
    expect(headings(pane)).toEqual([
      HOTEL_NAME,
      "Service agreements",
      "Site visits",
      "Booking milestones",
    ]);
    await fireEvent.press(within(pane).getByRole("tab", { name: "Activity" }));
    expect(headings(pane)).toEqual([HOTEL_NAME, "Activity"]);
    // The thread's rows sit straight on the pane's glass: its frame draws nothing.
    expect(screen.getByTestId("enquiry-activity").props.className).toContain("border-0");
  });

  it("keeps the same parts on a phone, under the page's header, whose back goes to the queue", async () => {
    mockWindow.width = 390;
    await renderDetail();
    expect(screen.queryByTestId("enquiry-queue-panel")).toBeNull();
    expect(screen.queryByTestId("enquiry-pane")).toBeNull();
    const split = screen.getByTestId("enquiries-split");
    expect(within(split).getByTestId("enquiry-pipeline")).toBeOnTheScreen();
    expect(headings(split)).toEqual([CLIENT_NAME, "Move the enquiry"]);
    await fireEvent.press(within(split).getByRole("tab", { name: "Activity" }));
    // Each section stands on the page as its own glass card.
    expect(screen.getByTestId("enquiry-activity").props.className).toContain("border-primary/16");
    await fireEvent.press(screen.getByLabelText("Back to enquiries"));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/enquiries");
  });
});
