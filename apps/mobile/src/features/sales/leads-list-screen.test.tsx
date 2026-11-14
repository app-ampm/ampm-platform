import type * as ReactModule from "react";
import type { ReactNode } from "react";
import { Text } from "react-native";

import type { LeadView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { act, fireEvent, screen, within } from "../../test/render";
import { LeadsListScreen } from "./leads-list-screen";
import { boardStatuses } from "./sales.format";
import {
  LEAD_ID,
  SECOND_LEAD_ID,
  failure,
  leadFixture,
  ok,
  renderWithApi,
  routedFetch,
  staffMeFixture,
  type FetchFn,
} from "./sales.test-utils";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: mockPush }),
}));

/**
 * The window, as a store its readers subscribe to: a resize re-renders exactly the components that read
 * the width, as React Native's own hook does (a plain mock would let React Compiler skip the re-render).
 * Its width picks the layout: the list alone below 768, the Board / List switch from there.
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

/** Resizes the window, telling every component that reads it (a tablet turning, a window resized). */
async function resizeTo(width: number): Promise<void> {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const HOUR = 3_600_000;

/** A demo-requesting new lead flagged as a duplicate, and a converted one owned by Sana. */
function pipeline(): LeadView[] {
  return [
    leadFixture({
      duplicateOfLeadId: "018f0000-0000-7000-8000-0000000001ff",
      createdAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    }),
    leadFixture({
      id: SECOND_LEAD_ID,
      name: "Ananya Sharma",
      email: null,
      phone: "+919800000000",
      status: "converted",
      requestedDemo: false,
      ownerName: "Sana Verma",
      ownerUserId: "018f0000-0000-7000-8000-00000000cafe",
    }),
  ];
}

const leadsFetch = (items: LeadView[], nextCursor: string | null = null): FetchFn =>
  routedFetch({ "/crm/leads": () => ok({ items, nextCursor }) });

const THIRD_LEAD_ID = "018f0000-0000-7000-8000-0000000003c3";

/** The pipeline plus one lead closed as lost. */
const withClosed = (): LeadView[] => [
  ...pipeline(),
  leadFixture({ id: THIRD_LEAD_ID, name: "Priya Nair", status: "closed", requestedDemo: false }),
];

/** Whether a chip reads as on: react-native-web's aria-pressed and the native selected state agree. */
const isOn = (testID: string): boolean =>
  screen.getByTestId(testID).props.accessibilityState?.selected === true;

/** Page 1 (the pipeline, more waiting) then page 2 (one more lead, the end) by cursor; answers /me too. */
const paginatedLeadsFetch = (): FetchFn => (input) => {
  const url = new URL(String(input));
  if (url.pathname === "/me") return Promise.resolve(ok(staffMeFixture(["SM"])));
  const cursor = url.searchParams.get("cursor");
  return Promise.resolve(
    ok(
      cursor
        ? { items: [leadFixture({ id: THIRD_LEAD_ID, name: "Priya Nair" })], nextCursor: null }
        : { items: pipeline(), nextCursor: "cursor-2" },
    ),
  );
};

/** The pipeline plus a signed-in `/me` of the given roles, for the funnel-link gate. */
const leadsFetchAs = (
  items: LeadView[],
  roles: ReturnType<typeof staffMeFixture>["roles"],
): FetchFn =>
  routedFetch({
    "/crm/leads": () => ok({ items, nextCursor: null }),
    "/me": () => ok(staffMeFixture(roles)),
  });

async function renderList(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<LeadsListScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockWindow.width = 390;
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe("LeadsListScreen on a phone", () => {
  it("shows skeleton rows while the leads load", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("leads-loading")).toBeOnTheScreen();
    expect(screen.getByText("Pipeline")).toBeOnTheScreen();
  });

  it("lists each lead with its stage, contact and flags, and counts the open ones", async () => {
    await renderList(leadsFetch(pipeline()));
    expect(await screen.findByText("Rohit Malhotra")).toBeOnTheScreen();
    expect(screen.getByText("Leads and clients · 1 open")).toBeOnTheScreen();
    const row = within(screen.getByTestId(`lead-row-${LEAD_ID}`));
    expect(row.getByText("New")).toBeOnTheScreen();
    expect(row.getByText("rohit@example.com")).toBeOnTheScreen();
    expect(row.getByText("12–14 DEC 2027 · Instagram")).toBeOnTheScreen();
    expect(row.getByText("Demo requested")).toBeOnTheScreen();
    expect(row.getByText("Possible duplicate")).toBeOnTheScreen();
    const converted = within(screen.getByTestId(`lead-row-${SECOND_LEAD_ID}`));
    expect(converted.getByText("Converted")).toBeOnTheScreen();
    expect(converted.getByText("+919800000000")).toBeOnTheScreen();
  });

  it("keeps every lead in the one list, closed too, with no view switch or chip row", async () => {
    await renderList(leadsFetch(withClosed()));
    expect(await screen.findByTestId(`lead-row-${THIRD_LEAD_ID}`)).toBeOnTheScreen();
    expect(screen.queryByTestId("leads-view")).toBeNull();
    expect(screen.queryByTestId("leads-filters")).toBeNull();
    expect(screen.queryByTestId("leads-board")).toBeNull();
  });

  it("opens a lead's detail from its row", async () => {
    await renderList(leadsFetch(pipeline()));
    await fireEvent.press(await screen.findByTestId(`lead-row-${SECOND_LEAD_ID}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/leads/[id]",
      params: { id: SECOND_LEAD_ID },
    });
  });

  it("marks the open count as a floor while more pages wait", async () => {
    await renderList(leadsFetch(pipeline(), SECOND_LEAD_ID));
    expect(await screen.findByText("Leads and clients · 1+ open")).toBeOnTheScreen();
  });

  it("keeps the app's tab bar", async () => {
    await renderList(leadsFetch(pipeline()), <Text testID="app-tab-bar">Tabs</Text>);
    expect(await screen.findByText("Rohit Malhotra")).toBeOnTheScreen();
    expect(screen.getByTestId("app-tab-bar")).toBeOnTheScreen();
  });

  it("loads the next page from the footer, appends it, and hides the footer at the end", async () => {
    await renderList(paginatedLeadsFetch());
    expect(await screen.findByText("Rohit Malhotra")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId("leads-load-more"));
    // The second page's lead appears, the first page is kept, and there is nothing left to load.
    expect(await screen.findByText("Priya Nair")).toBeOnTheScreen();
    expect(screen.getByText("Rohit Malhotra")).toBeOnTheScreen();
    expect(screen.queryByTestId("leads-load-more")).toBeNull();
  });

  it("keeps the loaded leads when Load more fails, and retries from the footer", async () => {
    let pageTwoAttempts = 0;
    const flaky: FetchFn = (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/me") return Promise.resolve(ok(staffMeFixture(["SM"])));
      if (!url.searchParams.get("cursor")) {
        return Promise.resolve(ok({ items: pipeline(), nextCursor: "cursor-2" }));
      }
      pageTwoAttempts += 1;
      return pageTwoAttempts === 1
        ? Promise.resolve(failure("internal", 500))
        : Promise.resolve(
            ok({
              items: [leadFixture({ id: THIRD_LEAD_ID, name: "Priya Nair" })],
              nextCursor: null,
            }),
          );
    };
    await renderList(flaky);
    expect(await screen.findByText("Rohit Malhotra")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId("leads-load-more"));
    // The page-2 failure does NOT wipe the list: page 1 stays and the footer offers a retry.
    expect(await screen.findByText("Couldn't load more — tap to retry")).toBeOnTheScreen();
    expect(screen.getByText("Rohit Malhotra")).toBeOnTheScreen();
    // Retrying from the footer succeeds and appends page 2.
    await fireEvent.press(screen.getByTestId("leads-load-more"));
    expect(await screen.findByText("Priya Nair")).toBeOnTheScreen();
    expect(screen.queryByTestId("leads-load-more")).toBeNull();
  });
});

describe("LeadsListScreen from 768 up", () => {
  beforeEach(() => {
    mockWindow.width = 1280;
  });

  it("shows a column per stage in pipeline order, Converted last and Closed held back", async () => {
    await renderList(leadsFetch(withClosed()));
    expect(await screen.findByTestId("leads-board")).toBeOnTheScreen();
    const columns = screen.getAllByTestId(/^leads-column-/).map((column) => column.props.testID);
    expect(columns).toEqual(boardStatuses(false).map((status) => `leads-column-${status}`));
    expect(columns.at(-1)).toBe("leads-column-converted");
    expect(within(screen.getByTestId("leads-column-new")).getByLabelText("1 lead")).toBeTruthy();
    expect(
      within(screen.getByTestId("leads-column-converted")).getByText("Ananya Sharma"),
    ).toBeOnTheScreen();
    expect(screen.queryByText("Priya Nair")).toBeNull();
    expect(screen.queryByTestId("leads-list")).toBeNull();
  });

  it("shares the board's width between the columns, down to a floor that scrolls", async () => {
    await renderList(leadsFetch(pipeline()));
    const column = await screen.findByTestId("leads-column-new");
    // T2's flex: 1 columns; the floor (144 from 1024) keeps a narrow window scrolling sideways.
    expect(column.props.className).toEqual(expect.stringContaining("flex-1"));
    expect(column.props.className).toEqual(expect.stringContaining("min-w-36"));
    expect(column.props.className).not.toEqual(expect.stringContaining("w-56 "));
    await resizeTo(900);
    expect(screen.getByTestId("leads-column-new").props.className).toEqual(
      expect.stringContaining("min-w-56"),
    );
  });

  it("brings the closed leads back as the last column from the Closed chip", async () => {
    await renderList(leadsFetch(withClosed()));
    const chip = await screen.findByTestId("leads-closed-filter");
    expect(within(chip).getByText("Closed · 1")).toBeOnTheScreen();
    expect(isOn("leads-closed-filter")).toBe(false);
    await fireEvent.press(chip);
    expect(isOn("leads-closed-filter")).toBe(true);
    const columns = screen.getAllByTestId(/^leads-column-/).map((column) => column.props.testID);
    expect(columns.at(-1)).toBe("leads-column-closed");
    expect(
      within(screen.getByTestId("leads-column-closed")).getByText("Priya Nair"),
    ).toBeOnTheScreen();
  });

  it("switches to the list, which hides closed leads until the chip is on", async () => {
    await renderList(leadsFetch(withClosed()));
    await fireEvent.press(await screen.findByText("List"));
    expect(screen.getByTestId("leads-list")).toBeOnTheScreen();
    expect(screen.queryByTestId("leads-board")).toBeNull();
    expect(screen.getByTestId(`lead-row-${LEAD_ID}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`lead-row-${THIRD_LEAD_ID}`)).toBeNull();
    await fireEvent.press(screen.getByTestId("leads-closed-filter"));
    expect(screen.getByTestId(`lead-row-${THIRD_LEAD_ID}`)).toBeOnTheScreen();
  });

  it("keeps the view picked and the Closed chip across 1024, and back from a phone", async () => {
    mockWindow.width = 1440;
    await renderList(leadsFetch(withClosed()));
    await fireEvent.press(await screen.findByText("List"));
    await fireEvent.press(screen.getByTestId("leads-closed-filter"));
    await resizeTo(900);
    expect(screen.getByTestId("leads-list")).toBeOnTheScreen();
    expect(isOn("leads-closed-filter")).toBe(true);
    expect(screen.getByTestId(`lead-row-${THIRD_LEAD_ID}`)).toBeOnTheScreen();
    await resizeTo(390);
    expect(screen.queryByTestId("leads-view")).toBeNull();
    await resizeTo(1440);
    expect(screen.getByTestId("leads-list")).toBeOnTheScreen();
    expect(screen.queryByTestId("leads-board")).toBeNull();
    expect(isOn("leads-closed-filter")).toBe(true);
  });

  it("puts where, when, source, age and owner on each card", async () => {
    await renderList(leadsFetch(pipeline()));
    const card = within(await screen.findByTestId(`lead-card-${LEAD_ID}`));
    expect(card.getByText("Udaipur or Goa · 12–14 DEC 2027 · 250 guests")).toBeOnTheScreen();
    expect(card.getByText("Instagram · 2h")).toBeOnTheScreen();
    const owned = within(screen.getByTestId(`lead-card-${SECOND_LEAD_ID}`));
    expect(owned.getByText("SV")).toBeOnTheScreen();
  });

  it("opens a lead's detail from its card", async () => {
    await renderList(leadsFetch(pipeline()));
    await fireEvent.press(await screen.findByTestId(`lead-card-${LEAD_ID}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/leads/[id]", params: { id: LEAD_ID } });
  });

  it("shows skeleton columns while the leads load", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("leads-loading")).toBeOnTheScreen();
  });
});

describe("LeadsListScreen states", () => {
  it("says where leads come from when there are none yet", async () => {
    await renderList(leadsFetch([]));
    expect(await screen.findByText("No enquiries yet")).toBeOnTheScreen();
    expect(screen.getByText("Leads and clients · 0 open")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderList(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("shows the error state with a retry when the API fails", async () => {
    await renderList(routedFetch({ "/crm/leads": () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderList(routedFetch({ "/crm/leads": () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view leads")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});

describe("LeadsListScreen funnel link", () => {
  it("offers the Funnel report to a role that holds the report key", async () => {
    await renderList(leadsFetchAs(pipeline(), ["SM"]));
    await fireEvent.press(await screen.findByTestId("leads-funnel-link"));
    expect(mockPush).toHaveBeenCalledWith("/leads/funnel");
  });

  it("hides the Funnel report from a role without the key, keeping Clients", async () => {
    await renderList(leadsFetchAs(pipeline(), ["HT"]));
    expect(await screen.findByTestId("leads-clients-link")).toBeOnTheScreen();
    expect(screen.queryByTestId("leads-funnel-link")).toBeNull();
  });
});
