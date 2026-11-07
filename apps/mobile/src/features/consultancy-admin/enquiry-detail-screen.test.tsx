import type { HotelEnquiryStaffDetailView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor, within } from "../../test/render";
import {
  ENQUIRY_ID,
  MILESTONE_ID,
  VISIT_ID,
  detailFixture,
  enquiryFixture,
  eventFixture,
  failure,
  jsonResponse,
  milestoneFixture,
  ok,
  page,
  renderWithApi,
  routedFetch,
  visitFixture,
  type FetchFn,
  type SentRequest,
} from "./consultancy-admin.test-utils";
import { StaffEnquiryDetailScreen } from "./enquiry-detail-screen";

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

// The agreements and proposals belong to the commercial view, which has its own tests; this file is
// about the queue's own parts of the screen.
jest.mock("./enquiry-commercial", () => ({
  AgreementSection: () => null,
  ProposalsSection: () => null,
}));

const DETAIL = `GET /consultancy-admin/enquiries/${ENQUIRY_ID}`;
const STATUS = `PATCH /consultancy-admin/enquiries/${ENQUIRY_ID}/status`;
const VISITS = "GET /consultancy-admin/site-visits";
const MILESTONES = "GET /consultancy-admin/booking-milestones";
const VISIT_STATUS = `PATCH /consultancy-admin/site-visits/${VISIT_ID}/status`;
const MILESTONE_STATUS = `PATCH /consultancy-admin/booking-milestones/${MILESTONE_ID}/status`;

/** The enquiry with one visit and one milestone; writes answer with the moved record. */
function enquiryFetch(
  detail: HotelEnquiryStaffDetailView,
  sent: SentRequest[] = [],
  status: () => Response = () => ok(enquiryFixture({ status: "awaiting_hotel" })),
): FetchFn {
  return routedFetch(
    {
      [DETAIL]: () => ok(detail),
      [STATUS]: status,
      [VISITS]: () => page([visitFixture()]),
      // Due on the day staff picked, sent as midnight UTC (consultancy-admin.form.ts).
      [MILESTONES]: () => page([milestoneFixture({ dueAt: "2027-01-31T00:00:00.000Z" })]),
      [VISIT_STATUS]: () => ok(visitFixture({ status: "confirmed" })),
      [MILESTONE_STATUS]: () => ok(milestoneFixture({ status: "done" })),
    },
    sent,
  );
}

async function renderDetail(fetchImpl: FetchFn): Promise<void> {
  await renderWithApi(<StaffEnquiryDetailScreen enquiryId={ENQUIRY_ID} />, fetchImpl);
}

const writes = (sent: readonly SentRequest[]) => sent.filter((request) => request.method !== "GET");

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
});

describe("StaffEnquiryDetailScreen: header and notes", () => {
  it("keeps the back button while the enquiry loads", async () => {
    await renderDetail(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("staff-enquiry-loading")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Back to enquiries"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("heads the screen with the stay as data, the title and the status chip", async () => {
    const detail = detailFixture({ roomsRequired: 60, datesFlexible: true });
    await renderDetail(enquiryFetch(detail));
    expect(await screen.findByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    expect(
      screen.getByText("12–14 FEB 2027 · 300 GUESTS · 60 ROOMS · FLEXIBLE DATES"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Submitted")).toBeOnTheScreen();
    expect(screen.getByText("Unassigned")).toBeOnTheScreen();
  });

  it("keeps the client's note and the internal note apart, the internal one in its panel", async () => {
    const detail = detailFixture({
      notesClient: "Is the lake lawn free on the 13th?",
      notesInternal: "GM away until Monday; 15% off rack rate for 60 rooms.",
    });
    await renderDetail(enquiryFetch(detail));
    const internal = await screen.findByTestId("enquiry-internal-note");
    expect(within(internal).getByText(uiCopy.internalPanel.label)).toBeOnTheScreen();
    expect(
      within(internal).getByText("GM away until Monday; 15% off rack rate for 60 rooms."),
    ).toBeOnTheScreen();
    const client = screen.getByTestId("enquiry-client-note");
    expect(within(client).getByText("Is the lake lawn free on the 13th?")).toBeOnTheScreen();
    expect(within(client).queryByText(uiCopy.internalPanel.label)).toBeNull();
  });

  it("draws no internal panel for a reader the internal note is not sent to", async () => {
    const { notesInternal: _absent, ...withoutNotes } = detailFixture();
    await renderDetail(enquiryFetch(withoutNotes));
    expect(await screen.findByText("Sangeet, wedding and reception")).toBeOnTheScreen();
    expect(screen.queryByTestId("enquiry-internal-note")).toBeNull();
  });
});

describe("StaffEnquiryDetailScreen: pipeline controls", () => {
  it("moves the enquiry on to the next step", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(enquiryFetch(detailFixture(), sent));
    expect(await screen.findByText("Advance")).toBeOnTheScreen();
    expect(screen.getByText("Proposal received")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Awaiting hotel"));
    await waitFor(() =>
      expect(writes(sent)).toContainEqual({
        method: "PATCH",
        path: `/consultancy-admin/enquiries/${ENQUIRY_ID}/status`,
        body: { status: "awaiting_hotel", outcome: null, summary: null },
      }),
    );
  });

  it("closes the enquiry with the outcome chosen", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(enquiryFetch(detailFixture(), sent));
    await fireEvent.press(await screen.findByText("Close…"));
    expect(screen.getByText("Close with outcome")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("No availability"));
    await waitFor(() =>
      expect(writes(sent)).toContainEqual({
        method: "PATCH",
        path: `/consultancy-admin/enquiries/${ENQUIRY_ID}/status`,
        body: { status: "closed", outcome: "no_availability", summary: null },
      }),
    );
  });

  it("says why a move was refused", async () => {
    const refused = () =>
      jsonResponse({ error: { code: "conflict", message: "Milestones are not done yet" } }, 409);
    await renderDetail(enquiryFetch(detailFixture(), [], refused));
    await fireEvent.press(await screen.findByText("Awaiting hotel"));
    expect(await screen.findByText("Milestones are not done yet")).toBeOnTheScreen();
    // Dismissing clears the toast's timer, so no handle outlives the test.
    await fireEvent.press(screen.getByLabelText(uiCopy.dismiss));
    expect(screen.queryByText("Milestones are not done yet")).toBeNull();
  });

  it("offers no moves on a closed enquiry", async () => {
    await renderDetail(enquiryFetch(detailFixture({ status: "closed", outcome: "booked" })));
    expect(await screen.findByText("This enquiry is closed.")).toBeOnTheScreen();
    expect(screen.queryByText("Advance")).toBeNull();
  });
});

describe("StaffEnquiryDetailScreen: visits and milestones", () => {
  it("puts the site visit on the stepper, its internal notes in the internal panel", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(enquiryFetch(detailFixture(), sent));
    expect(await screen.findByLabelText("20 Nov 2026, current step")).toBeOnTheScreen();
    const visits = screen.getByTestId("site-visits");
    expect(within(visits).getByText("Proposed")).toBeOnTheScreen();
    expect(
      within(visits).getByText("Attendees: Meera and the hotel's sales manager"),
    ).toBeOnTheScreen();
    expect(within(visits).getByText(uiCopy.internalPanel.label)).toBeOnTheScreen();
    await fireEvent.press(within(visits).getByText("Confirmed"));
    await waitFor(() =>
      expect(writes(sent)).toContainEqual({
        method: "PATCH",
        path: `/consultancy-admin/site-visits/${VISIT_ID}/status`,
        body: { status: "confirmed" },
      }),
    );
  });

  it("puts the milestones on the stepper and marks one done", async () => {
    const sent: SentRequest[] = [];
    await renderDetail(enquiryFetch(detailFixture(), sent));
    expect(
      await screen.findByLabelText("Advance payment, current step, Due 31 Jan 2027"),
    ).toBeOnTheScreen();
    const milestones = screen.getByTestId("milestones");
    expect(within(milestones).getByText("Pending")).toBeOnTheScreen();
    expect(within(milestones).getByText("₹9,50,000")).toBeOnTheScreen();
    await fireEvent.press(within(milestones).getByText("Done"));
    await waitFor(() =>
      expect(writes(sent)).toContainEqual({
        method: "PATCH",
        path: `/consultancy-admin/booking-milestones/${MILESTONE_ID}/status`,
        body: { status: "done" },
      }),
    );
  });

  it("says what creates the first visit and milestone", async () => {
    await renderDetail(
      routedFetch({
        [DETAIL]: () => ok(detailFixture()),
        [VISITS]: () => page([]),
        [MILESTONES]: () => page([]),
      }),
    );
    expect(
      await screen.findByText(
        "No site visit yet. Schedule one when the client wants to see the hotel.",
      ),
    ).toBeOnTheScreen();
    expect(
      await screen.findByText("No milestone yet. Add them once the hotel holds the dates."),
    ).toBeOnTheScreen();
    expect(screen.getByText("New site visit")).toBeOnTheScreen();
    expect(screen.getByText("New milestone")).toBeOnTheScreen();
  });
});

describe("StaffEnquiryDetailScreen: activity", () => {
  const events = [
    eventFixture({
      id: "018f0000-0000-7000-8000-0000000007c2",
      eventType: "negotiation_note",
      summary: "Sales manager offers 15% off for 60 rooms.",
      internalOnly: true,
    }),
    eventFixture({ eventType: "hotel_response", summary: "The lawn is free on the 13th." }),
  ];

  it("shows every event, the internal ones in internal panels, and filters them", async () => {
    await renderDetail(enquiryFetch(detailFixture({ events })));
    expect(await screen.findByText("Internal · Negotiation update")).toBeOnTheScreen();
    expect(screen.getByText("The lawn is free on the 13th.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Internal"));
    expect(screen.getByText("Sales manager offers 15% off for 60 rooms.")).toBeOnTheScreen();
    expect(screen.queryByText("The lawn is free on the 13th.")).toBeNull();

    await fireEvent.press(screen.getByText("Client-visible"));
    expect(screen.getByText("The lawn is free on the 13th.")).toBeOnTheScreen();
    expect(screen.queryByText("Sales manager offers 15% off for 60 rooms.")).toBeNull();
  });

  it("says when a filter has nothing to show", async () => {
    await renderDetail(enquiryFetch(detailFixture({ events: [events[1] ?? eventFixture()] })));
    await fireEvent.press(await screen.findByText("Internal"));
    expect(screen.getByText("No internal activity yet.")).toBeOnTheScreen();
  });
});

describe("StaffEnquiryDetailScreen: states", () => {
  it("shows the not-found state for an enquiry outside the reader's reach", async () => {
    await renderDetail(routedFetch({}));
    expect(await screen.findByText("Enquiry not found")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderDetail(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("asks a signed-out reader to sign in", async () => {
    await renderDetail(routedFetch({ [DETAIL]: () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view this enquiry")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("tells a role without the grant that the enquiry is not theirs", async () => {
    await renderDetail(routedFetch({ [DETAIL]: () => failure("forbidden", 403) }));
    expect(await screen.findByText("Not available for your role")).toBeOnTheScreen();
  });

  it("shows the retryable error state on a server failure", async () => {
    await renderDetail(routedFetch({ [DETAIL]: () => failure("internal", 500) }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });
});
