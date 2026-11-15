import { fireEvent, screen, within } from "../../test/render";
import {
  ENQUIRY_ID,
  detailFixture,
  ok,
  page,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./consultancy-admin.test-utils";
import { StaffEnquiryDetailScreen } from "./enquiry-detail-screen";

jest.mock("expo-router", () => ({
  useRouter: () => ({ dismissTo: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

// The proposals and agreements have their own tests (enquiry-commercial.test).
jest.mock("./enquiry-commercial", () => ({
  AgreementSection: () => null,
  ProposalsSection: () => null,
}));

type Detail = ReturnType<typeof detailFixture>;

/** The enquiry, with nothing on its booking tab. */
function enquiryFetch(detail: Detail): FetchFn {
  return routedFetch({
    [`GET /consultancy-admin/enquiries/${ENQUIRY_ID}`]: () => ok(detail),
    "GET /consultancy-admin/site-visits": () => page([]),
    "GET /consultancy-admin/booking-milestones": () => page([]),
  });
}

async function renderDetail(fetchImpl: FetchFn): Promise<void> {
  await renderWithApi(<StaffEnquiryDetailScreen enquiryId={ENQUIRY_ID} />, fetchImpl);
}

async function openTab(name: "Overview" | "Proposals" | "Activity" | "Booking"): Promise<void> {
  await fireEvent.press(await screen.findByRole("tab", { name }));
}

/** The staff enquiry page's pipeline: where it stands, the next step, and the tab it opens on. */
describe("StaffEnquiryDetailScreen: pipeline and overview", () => {
  it("puts the enquiry on the pipeline and says the next step", async () => {
    await renderDetail(enquiryFetch(detailFixture()));
    expect(await screen.findByLabelText("New request, current step")).toBeOnTheScreen();
    expect(screen.getByLabelText("Confirmed, not started")).toBeOnTheScreen();
    const next = screen.getByTestId("enquiry-next-step");
    expect(within(next).getByText("New request")).toBeOnTheScreen();
    // A new request opens on its overview, which is where its next step is.
    expect(screen.getByRole("tab", { name: "Overview" })).toBeSelected();
  });

  it("opens on the proposals, and links there, while a proposal waits on the team", async () => {
    const detail = detailFixture({
      status: "proposal_received",
      latestProposal: {
        id: "018f0000-0000-7000-8000-0000000008d1",
        versionNumber: 3,
        status: "draft",
      },
    });
    await renderDetail(enquiryFetch(detail));
    expect(await screen.findByText("Version 3 is a draft")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Proposals" })).toBeSelected();
    expect(screen.getByLabelText("Proposal, current step")).toBeOnTheScreen();
    await openTab("Overview");
    await fireEvent.press(screen.getByText("Go to proposals"));
    expect(screen.getByRole("tab", { name: "Proposals" })).toBeSelected();
  });

  it("names who sent it on the overview, with the request laid out", async () => {
    const detail = detailFixture({
      roomsRequired: 60,
      contactPreference: "WhatsApp after 6pm",
      notesClient: "Is the lake lawn free on the 13th?",
    });
    await renderDetail(enquiryFetch(detail));
    const client = await screen.findByTestId("enquiry-client-card");
    expect(within(client).getByText("Ananya Sharma")).toBeOnTheScreen();
    expect(within(client).getByLabelText("Prefers: WhatsApp after 6pm")).toBeOnTheScreen();
    const request = screen.getByTestId("enquiry-request-card");
    expect(within(request).getByLabelText("Hotel: The Lake Pavilion")).toBeOnTheScreen();
    expect(within(request).getByLabelText("Guests: 300 guests")).toBeOnTheScreen();
    expect(within(request).getByLabelText("Rooms: 60 rooms")).toBeOnTheScreen();
    expect(within(request).getByText("Is the lake lawn free on the 13th?")).toBeOnTheScreen();
  });
});
