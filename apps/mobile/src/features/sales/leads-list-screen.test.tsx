import type { ReactNode } from "react";
import { Text } from "react-native";

import type { LeadView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import { LeadsListScreen } from "./leads-list-screen";
import { PIPELINE_STATUSES } from "./sales.format";
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

// The window's width picks the layout: the board from 768 up, the list below. Each test sets it.
const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

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
});

describe("LeadsListScreen from 768 up", () => {
  beforeEach(() => {
    mockWindow.width = 1280;
  });

  it("shows a column per stage in pipeline order, each with its count", async () => {
    await renderList(leadsFetch(pipeline()));
    expect(await screen.findByTestId("leads-board")).toBeOnTheScreen();
    const columns = screen.getAllByTestId(/^leads-column-/).map((column) => column.props.testID);
    expect(columns).toEqual(PIPELINE_STATUSES.map((status) => `leads-column-${status}`));
    expect(within(screen.getByTestId("leads-column-new")).getByLabelText("1 lead")).toBeTruthy();
    expect(
      within(screen.getByTestId("leads-column-converted")).getByText("Ananya Sharma"),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId("leads-column-closed")).getByText("No leads")).toBeTruthy();
    expect(screen.queryByTestId("leads-list")).toBeNull();
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
