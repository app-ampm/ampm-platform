import type { ReactNode } from "react";
import { Text } from "react-native";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import {
  ENQUIRY_ID,
  SECOND_ENQUIRY_ID,
  enquiryFixture,
  failure,
  page,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./consultancy-admin.test-utils";
import { StaffEnquiriesListScreen } from "./enquiries-list-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, push: mockPush }),
  // A phone-sized window (jest-expo's): the page never opens an enquiry beside the queue here, so its
  // focus effect has nothing to do; enquiries-desktop.test covers it from 1024.
  useFocusEffect: () => undefined,
}));

const LIST = "GET /consultancy-admin/enquiries";

/** A new enquiry nobody holds yet, and a held one waiting on the hotel; one draft that is not open. */
function queue() {
  return [
    enquiryFixture(),
    enquiryFixture({
      id: SECOND_ENQUIRY_ID,
      status: "awaiting_hotel",
      functionsSummary: null,
      assignedUserId: "018f0000-0000-7000-8000-00000000cafe",
      dateFrom: "2027-02-28",
      dateTo: "2027-03-02",
      guestEstimate: 1,
    }),
    enquiryFixture({
      id: "018f0000-0000-7000-8000-0000000004e3",
      status: "draft",
      functionsSummary: "Engagement lunch",
      submittedAt: null,
    }),
  ];
}

async function renderList(fetchImpl: FetchFn, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<StaffEnquiriesListScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
});

describe("StaffEnquiriesListScreen", () => {
  it("shows the loading rows while the queue is pending", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("staff-enquiries-loading")).toBeOnTheScreen();
    expect(screen.getByText("Enquiries")).toBeOnTheScreen();
  });

  it("lists the queue as rows with the stay as data, the status and who holds it", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    expect(await screen.findByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    // Two of the three are in the pipeline's active stretch; the draft is still the client's.
    expect(screen.getByText("2 open")).toBeOnTheScreen();
    // The submitted enquiry and the draft share the stay.
    expect(screen.getAllByText("12–14 FEB 2027")).toHaveLength(2);
    expect(screen.getByText("300 guests · submitted 3 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText("28 FEB – 2 MAR 2027")).toBeOnTheScreen();
    expect(screen.getByText("1 guest · submitted 3 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText("Engagement lunch")).toBeOnTheScreen();
    expect(screen.getByText(/created 3 Nov 2026/)).toBeOnTheScreen();
  });

  it("names each row for screen readers: title, status, holder and stay", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    const row = await screen.findByLabelText(
      "Sangeet, wedding and reception, Submitted, Unassigned, 300 guests · submitted 3 Nov 2026, 12–14 Feb 2027",
    );
    expect(within(row).getByText("Submitted")).toBeOnTheScreen();
    expect(within(row).getByText("Unassigned")).toBeOnTheScreen();
    const held = screen.getByLabelText(/^Hotel enquiry, Awaiting hotel, 1 guest/);
    expect(within(held).queryByText("Unassigned")).toBeNull();
  });

  it("opens the enquiry's detail when a row is pressed", async () => {
    await renderList(routedFetch({ [LIST]: () => page(queue()) }));
    await fireEvent.press(await screen.findByText("Sangeet, wedding and reception"));
    expect(mockPush).toHaveBeenCalledWith(`/enquiries/${ENQUIRY_ID}`);
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
