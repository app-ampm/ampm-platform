import type { ReactNode } from "react";
import { Text } from "react-native";

import type { HotelEnquiryAssigneeFilter, HotelEnquiryStage } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import {
  ENQUIRY_ID,
  SECOND_ENQUIRY_ID,
  enquiryFixture,
  failure,
  ok,
  page,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./consultancy-admin.test-utils";
import { StaffEnquiriesListScreen } from "./enquiries-list-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: mockReplace,
    push: mockPush,
    setParams: mockSetParams,
  }),
  // A phone-sized window (jest-expo's): the page never opens an enquiry beside the queue here, so its
  // focus effect has nothing to do; enquiries-desktop.test covers it from 1024.
  useFocusEffect: () => undefined,
}));

const LIST = "GET /consultancy-admin/enquiries";

/**
 * A new enquiry nobody holds yet; a held one waiting on the hotel, its second proposal with the
 * client; and a draft that is not open, whose account's name did not come back.
 */
function queue() {
  return [
    enquiryFixture(),
    enquiryFixture({
      id: SECOND_ENQUIRY_ID,
      status: "awaiting_hotel",
      functionsSummary: null,
      accountName: "Kapoor family",
      hotelName: "Rose Fort Palace",
      assignedUserId: "018f0000-0000-7000-8000-00000000cafe",
      assignedUserName: "Meera Iyer",
      dateFrom: "2027-02-28",
      dateTo: "2027-03-02",
      guestEstimate: 1,
      latestProposal: {
        id: "018f0000-0000-7000-8000-0000000008d1",
        versionNumber: 2,
        status: "shared",
      },
    }),
    enquiryFixture({
      id: "018f0000-0000-7000-8000-0000000004e3",
      status: "draft",
      functionsSummary: "Engagement lunch",
      accountName: null,
      submittedAt: null,
    }),
  ];
}

async function renderList(
  fetchImpl: FetchFn,
  tabBar?: ReactNode,
  stage: HotelEnquiryStage | null = null,
  assignee: HotelEnquiryAssigneeFilter | null = null,
): Promise<void> {
  await renderWithApi(
    <StaffEnquiriesListScreen tabBar={tabBar} stage={stage} assignee={assignee} />,
    fetchImpl,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSetParams.mockClear();
});

describe("StaffEnquiriesListScreen", () => {
  it("shows the loading rows while the queue is pending", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("staff-enquiries-loading")).toBeOnTheScreen();
    expect(screen.getByText("Enquiries")).toBeOnTheScreen();
  });

  it("lists the queue as rows led by the client, with the hotel, the stay as data and the status", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    expect(await screen.findByText("Ananya Sharma")).toBeOnTheScreen();
    // Two of the three are in the pipeline's active stretch; the draft is still the client's.
    expect(screen.getByText("2 open")).toBeOnTheScreen();
    // The submitted enquiry and the draft share the stay.
    expect(screen.getAllByText("12–14 FEB 2027")).toHaveLength(2);
    expect(
      screen.getByText("The Lake Pavilion · 300 guests · submitted 3 Nov 2026"),
    ).toBeOnTheScreen();
    expect(screen.getByText("Kapoor family")).toBeOnTheScreen();
    expect(screen.getByText("28 FEB – 2 MAR 2027")).toBeOnTheScreen();
    expect(screen.getByText("Rose Fort Palace · 1 guest · submitted 3 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText("Proposal v2 · shared")).toBeOnTheScreen();
    // Without the account's name, what is being planned names the row.
    expect(screen.getByText("Engagement lunch")).toBeOnTheScreen();
    expect(screen.getByText(/created 3 Nov 2026/)).toBeOnTheScreen();
  });

  it("names each row for screen readers: client, status, proposal, holder, hotel and stay", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    const row = await screen.findByLabelText(
      "Ananya Sharma, Submitted, Unassigned, The Lake Pavilion · 300 guests · submitted 3 Nov 2026, 12–14 Feb 2027",
    );
    expect(within(row).getByText("Submitted")).toBeOnTheScreen();
    expect(within(row).getByText("Unassigned")).toBeOnTheScreen();
    const held = screen.getByLabelText(
      /^Kapoor family, Awaiting hotel, Proposal v2 · shared, Held by Meera Iyer, Rose Fort Palace · 1 guest/,
    );
    expect(within(held).queryByText("Unassigned")).toBeNull();
    expect(within(held).getByText("Meera I.")).toBeOnTheScreen();
  });

  it("opens the enquiry's detail when a row is pressed", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    await fireEvent.press(await screen.findByText("Ananya Sharma"));
    expect(mockPush).toHaveBeenCalledWith(`/enquiries/${ENQUIRY_ID}`);
  });

  it("shows the stage the address names, each chip counting its stage", async () => {
    const asked: string[] = [];
    const fetchImpl: FetchFn = (input) => {
      const url = String(input);
      asked.push(url);
      if (url.endsWith("/consultancy-admin/enquiries/pipeline"))
        return Promise.resolve(
          ok({
            stages: {
              new: 1,
              with_hotel: 1,
              proposal: 0,
              client_decision: 0,
              confirmed: 0,
              closed: 3,
            },
            unassignedOpen: 1,
            mineOpen: 0,
          }),
        );
      if (url.includes("stage=closed")) return Promise.resolve(page([]));
      return Promise.resolve(page(queue()));
    };
    await renderList(fetchImpl, undefined, "closed");
    expect(await screen.findByText("Nothing at this stage")).toBeOnTheScreen();
    expect(asked.some((url) => url.includes("/consultancy-admin/enquiries?stage=closed"))).toBe(
      true,
    );
    expect(await screen.findByRole("button", { name: /^Closed/ })).toBeSelected();
  });

  it("writes a chosen stage into the address, and clears it with All", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    await fireEvent.press(await screen.findByRole("button", { name: /^With hotel/ }));
    expect(mockSetParams).toHaveBeenLastCalledWith({ stage: "with_hotel" });
    await fireEvent.press(screen.getByRole("button", { name: /^All/ }));
    expect(mockSetParams).toHaveBeenLastCalledWith({ stage: undefined });
  });

  it("counts the reader's open enquiries and the unassigned ones on the owner chips", async () => {
    const pipeline = {
      stages: { new: 1, with_hotel: 1, proposal: 0, client_decision: 0, confirmed: 0, closed: 0 },
      unassignedOpen: 4,
      mineOpen: 2,
    };
    await renderList(
      routedFetch({
        [LIST]: () => page(queue()),
        "GET /consultancy-admin/enquiries/pipeline": () => ok(pipeline),
      }),
    );
    const owner = await screen.findByTestId("enquiry-assignee-filter");
    expect(await within(owner).findByRole("button", { name: /^Mine.*2/ })).toBeOnTheScreen();
    expect(within(owner).getByRole("button", { name: /^Unassigned.*4/ })).toBeOnTheScreen();
    expect(within(owner).getByRole("button", { name: /^Everyone/ })).toBeSelected();
  });

  it("writes the owner filter into the address, and clears it with Everyone", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    await fireEvent.press(await screen.findByTestId("enquiry-assignee-unassigned"));
    expect(mockSetParams).toHaveBeenLastCalledWith({ assignee: "unassigned" });
    await fireEvent.press(screen.getByTestId("enquiry-assignee-all"));
    expect(mockSetParams).toHaveBeenLastCalledWith({ assignee: undefined });
  });

  it("asks for the reader's open enquiries and says so when there are none", async () => {
    const asked: string[] = [];
    const fetchImpl: FetchFn = (input) => {
      asked.push(String(input));
      return Promise.resolve(page([]));
    };
    await renderList(fetchImpl, undefined, "proposal", "me");
    expect(await screen.findByText("Nothing of yours open")).toBeOnTheScreen();
    expect(screen.getByText(/No open enquiry at this stage is assigned to you/)).toBeOnTheScreen();
    expect(asked.some((url) => url.includes("enquiries?stage=proposal&assignee=me"))).toBe(true);
    expect(screen.getByTestId("enquiry-assignee-me")).toBeSelected();
  });

  it("marks the open count as partial while older enquiries are on later pages", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue(), SECOND_ENQUIRY_ID) }));
    expect(await screen.findByText("2+ open")).toBeOnTheScreen();
  });

  it("shows the empty state, saying what fills the queue", async () => {
    await renderList(routedFetch({ [LIST]: () => page([]) }));
    expect(await screen.findByText("No hotel enquiries yet")).toBeOnTheScreen();
    expect(
      screen.getByText("Enquiries arrive here when a client asks AMPM to check a hotel."),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/open$/)).toBeNull();
  });

  it("shows the offline state on a network failure", async () => {
    await renderList(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("asks a signed-out reader to sign in", async () => {
    await renderList(routedFetch({ [LIST]: () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view enquiries")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("tells a role without the grant that the queue is not theirs", async () => {
    await renderList(routedFetch({ [LIST]: () => failure("forbidden", 403) }));
    expect(await screen.findByText("Not available for your role")).toBeOnTheScreen();
  });

  it("shows the retryable error state on a server failure", async () => {
    await renderList(routedFetch({ [LIST]: () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("carries the tab bar the route passes in", async () => {
    await renderList(routedFetch({ [LIST]: () => page([]) }), <Text>Staff tabs</Text>);
    expect(await screen.findByText("Staff tabs")).toBeOnTheScreen();
  });
});
