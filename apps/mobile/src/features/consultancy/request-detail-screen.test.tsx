import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { renderWithApi } from "../../test/api";
import {
  ENQUIRY_DETAIL,
  ENQUIRY_ID,
  fail,
  fakeApi,
  HOTEL,
  HOTEL_ID,
  ok,
  page,
  PROPOSAL_ID,
  SHARED_PROPOSAL,
  type FakeCall,
  type FakeResponse,
} from "./consultancy.fixtures";
import { RequestDetailScreen } from "./request-detail-screen";

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const DECISION = `POST /consultancy/proposals/${PROPOSAL_ID}/decision`;

/** The API around one enquiry: its hotel, a shared proposal, and no agreement, visits or milestones. */
function enquiryApi(overrides: Record<string, FakeResponse> = {}, calls: FakeCall[] = []) {
  return fakeApi(
    {
      [`GET /consultancy/enquiries/${ENQUIRY_ID}`]: ok(ENQUIRY_DETAIL),
      [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
      "GET /crm/portal/service-agreements": ok(page([])),
      [`GET /consultancy/enquiries/${ENQUIRY_ID}/proposals`]: ok(page([SHARED_PROPOSAL])),
      [`GET /consultancy/enquiries/${ENQUIRY_ID}/visits`]: ok(page([])),
      [`GET /consultancy/enquiries/${ENQUIRY_ID}/milestones`]: ok(page([])),
      [DECISION]: ok({ ...SHARED_PROPOSAL, status: "accepted" }),
      ...overrides,
    },
    calls,
  );
}

async function renderDetail(fetchImpl: typeof fetch): Promise<void> {
  await renderWithApi(<RequestDetailScreen enquiryId={ENQUIRY_ID} />, fetchImpl);
}

beforeEach(() => jest.clearAllMocks());

describe("RequestDetailScreen", () => {
  it("shows the loading skeleton while the enquiry is pending", async () => {
    await renderDetail(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("request-detail-loading")).toBeOnTheScreen();
    expect(screen.getByText("Hotel request")).toBeOnTheScreen();
  });

  it("titles the request with its hotel, its status and where it stands", async () => {
    await renderDetail(enquiryApi());
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    // The chip's word, and the stepper's steps each read with their state.
    expect(screen.getByLabelText("Your decision")).toBeOnTheScreen();
    expect(screen.getByLabelText("Proposal shared, done")).toBeOnTheScreen();
    expect(screen.getByLabelText("Your decision, current step")).toBeOnTheScreen();
    expect(screen.getByText("12–14 Feb 2027 · 300 guests · 80 rooms")).toBeOnTheScreen();
    expect(screen.getByText("Sangeet, wedding, reception")).toBeOnTheScreen();
    expect(
      screen.getByText("The lawn is free on the 13th and holds 350 for a sangeet."),
    ).toBeOnTheScreen();
  });

  it("shows the shared proposal's lines and client total", async () => {
    await renderDetail(enquiryApi());
    expect(await screen.findByText("Proposal, version 2")).toBeOnTheScreen();
    expect(screen.getByText("Awaiting your decision")).toBeOnTheScreen();
    expect(screen.getByText("Rooms, 3 nights × 80")).toBeOnTheScreen();
    expect(screen.getByText("₹46,80,000")).toBeOnTheScreen();
    expect(screen.getByText("₹70,50,000")).toBeOnTheScreen();
  });

  it("records an acceptance through the decision endpoint", async () => {
    const calls: FakeCall[] = [];
    await renderDetail(enquiryApi({}, calls));
    await fireEvent.press(await screen.findByRole("button", { name: "Accept proposal" }));
    await waitFor(() =>
      expect(calls).toContainEqual({ route: DECISION, body: { decision: "accepted" } }),
    );
  });

  it("asks for a revision, or declines, through the same endpoint", async () => {
    const calls: FakeCall[] = [];
    await renderDetail(enquiryApi({}, calls));
    await fireEvent.press(await screen.findByRole("button", { name: "Request a revision" }));
    await waitFor(() =>
      expect(calls).toContainEqual({ route: DECISION, body: { decision: "revision_requested" } }),
    );
    // A press while a decision is in flight is ignored, so wait for the first one to settle.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Request a revision" })).not.toBeBusy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() =>
      expect(calls).toContainEqual({ route: DECISION, body: { decision: "declined" } }),
    );
  });

  it("keeps a failed proposals load visible as an error, not as no proposal", async () => {
    await renderDetail(
      enquiryApi({ [`GET /consultancy/enquiries/${ENQUIRY_ID}/proposals`]: fail(500, "internal") }),
    );
    expect(await screen.findByText("Proposals")).toBeOnTheScreen();
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("shows not found for an enquiry outside the client's reach", async () => {
    await renderDetail(fakeApi({}));
    expect(await screen.findByText("Request not found")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderDetail(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("goes back from its header", async () => {
    await renderDetail(() => new Promise<Response>(() => {}));
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
