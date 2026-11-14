import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import { LeadDetailScreen } from "./lead-detail-screen";
import {
  ACCOUNT_ID,
  LEAD_ID,
  STAFF_USER_ID,
  activityFixture,
  failure,
  leadDetailFetch,
  leadFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./sales.test-utils";

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

// The window's width picks the layout; lead-detail-desktop.test.tsx resizes it mid-task.
const mockWindow = { width: 390 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const LEAD_PATH = `/crm/leads/${LEAD_ID}`;
const CONVERTED_AT = "2026-11-03T10:00:00Z";

/** What `POST /crm/leads/:id/convert` returns: the account, its primary contact, the invite flag. */
function convertResult(inviteQueued: boolean) {
  const account = {
    id: ACCOUNT_ID,
    name: "Rohit Malhotra",
    coupleNames: null,
    preferredLocations: null,
    status: "prospect",
    isDemo: false,
    leadId: LEAD_ID,
    primaryContactUserId: null,
    internalNotes: null,
    createdAt: CONVERTED_AT,
    updatedAt: CONVERTED_AT,
  };
  const primaryContact = {
    id: "018f0000-0000-7000-8000-0000000002cc",
    accountId: ACCOUNT_ID,
    name: "Rohit Malhotra",
    relation: "self",
    phone: null,
    email: "rohit@example.com",
    isDecisionMaker: true,
    userId: null,
    createdAt: CONVERTED_AT,
  };
  return { account, primaryContact, inviteQueued };
}

type Routes = Parameters<typeof routedFetch>[0];

const detailFetch = leadDetailFetch;

async function renderDetail(fetchImpl: FetchFn): Promise<void> {
  await renderWithApi(<LeadDetailScreen leadId={LEAD_ID} />, fetchImpl);
}

/** Presses the one gold action and waits for its toast; then dismisses it, so no timer outlives the test. */
async function convertAndReadToast(title: string): Promise<void> {
  await fireEvent.press(await screen.findByText("Create account and invite"));
  expect(await screen.findByText(title)).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText(uiCopy.dismiss));
}

beforeEach(() => {
  mockWindow.width = 390;
  mockBack.mockClear();
  mockReplace.mockClear();
});

describe("LeadDetailScreen", () => {
  it("shows the loading skeleton under a header that can go back", async () => {
    await renderDetail(() => new Promise<Response>(() => {}));
    expect(screen.getByTestId("lead-loading")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Back"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("heads the lead with T3's record panel: name, stage, facts line and actions", async () => {
    await renderDetail(detailFetch(leadFixture()));
    const header = within(await screen.findByTestId("lead-header"));
    expect(await header.findByText("Rohit Malhotra")).toBeOnTheScreen();
    expect(header.getByLabelText("New")).toBeOnTheScreen();
    expect(
      header.getByText(
        "Udaipur or Goa · 12–14 DEC 2027 · About 250 guests · Source: Instagram · Owner: Unassigned",
      ),
    ).toBeOnTheScreen();
    expect(header.getByRole("button", { name: "Log activity" })).toBeOnTheScreen();
    // The invitation's send button is the one gold action, so it stays out of the header.
    expect(header.queryByText("Create account and invite")).toBeNull();
  });

  it("keeps the contact and requirements on their own card", async () => {
    await renderDetail(detailFetch(leadFixture()));
    const contact = within(await screen.findByTestId("lead-contact"));
    expect(contact.getByLabelText("Email: rohit@example.com")).toBeOnTheScreen();
    expect(contact.getByLabelText("Phone: +919911023344")).toBeOnTheScreen();
    expect(contact.getByLabelText("Marketing consent: No")).toBeOnTheScreen();
    expect(
      contact.getByLabelText("Requirements: Lakeside venue for three functions."),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Demo requested: Yes")).toBeOnTheScreen();
  });

  it("offers one invitation action that names the email it goes to", async () => {
    await renderDetail(detailFetch(leadFixture()));
    const invite = within(await screen.findByTestId("lead-invite"));
    expect(
      invite.getByText(
        "Creates the client account and invites rohit@example.com to the client portal.",
      ),
    ).toBeOnTheScreen();
    expect(invite.getByRole("button", { name: "Create account and invite" })).toBeOnTheScreen();
  });

  it("shows where a live demo stands", async () => {
    await renderDetail(detailFetch(leadFixture({ status: "demo_offered" })));
    const demo = within(await screen.findByTestId("lead-demo"));
    expect(demo.getByText("Offered")).toBeOnTheScreen();
    expect(screen.getByLabelText("Demo offered")).toBeOnTheScreen();
  });

  it("converts the lead with its email as the primary contact", async () => {
    const bodies: unknown[] = [];
    const routes: Routes = {
      [`${LEAD_PATH}/convert`]: (init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return ok(convertResult(true));
      },
    };
    await renderDetail(detailFetch(leadFixture(), routes));
    await convertAndReadToast("Converted — invite sent");
    expect(bodies).toEqual([
      { primaryContact: { email: "rohit@example.com", isDecisionMaker: true } },
    ]);
  });

  it("says when the invite is still pending after the account exists", async () => {
    const routes: Routes = { [`${LEAD_PATH}/convert`]: () => ok(convertResult(false)) };
    await renderDetail(detailFetch(leadFixture(), routes));
    await convertAndReadToast("Converted — invite pending");
  });

  it("says when someone converted the lead first", async () => {
    const routes: Routes = { [`${LEAD_PATH}/convert`]: () => failure("conflict", 409) };
    await renderDetail(detailFetch(leadFixture(), routes));
    await convertAndReadToast("This lead was already converted");
  });

  it("reports any other failure to convert", async () => {
    const routes: Routes = { [`${LEAD_PATH}/convert`]: () => failure("internal", 500) };
    await renderDetail(detailFetch(leadFixture(), routes));
    await convertAndReadToast("Could not convert the lead");
  });

  it("shows a converted lead as done, without the action", async () => {
    const lead = leadFixture({
      status: "converted",
      convertedAccountId: ACCOUNT_ID,
      convertedAt: CONVERTED_AT,
    });
    await renderDetail(detailFetch(lead));
    expect(await screen.findByText("Converted to a client account")).toBeOnTheScreen();
    expect(screen.queryByText("Create account and invite")).toBeNull();
  });

  it("explains a closed lead with its reason", async () => {
    const lead = leadFixture({ status: "closed", closedReason: "Chose another planner." });
    await renderDetail(detailFetch(lead));
    expect(await screen.findByText("This lead is closed")).toBeOnTheScreen();
    expect(screen.getByText("Chose another planner.")).toBeOnTheScreen();
    expect(screen.queryByText("Create account and invite")).toBeNull();
  });

  it("asks for an email before the lead can be converted", async () => {
    await renderDetail(detailFetch(leadFixture({ email: null })));
    expect(await screen.findByText("Add an email before converting this lead")).toBeOnTheScreen();
    expect(screen.queryByText("Create account and invite")).toBeNull();
  });

  it("shows the activity timeline when the lead has activity", async () => {
    const items = [
      activityFixture({ occurredAt: new Date(2026, 10, 2, 11, 30).toISOString() }),
      activityFixture({
        id: "018f0000-0000-7000-8000-0000000003ad",
        activityType: "note",
        summary: null,
      }),
    ];
    await renderDetail(
      detailFetch(leadFixture(), { [`${LEAD_PATH}/activities`]: () => ok({ items }) }),
    );
    const timeline = within(await screen.findByTestId("lead-activity"));
    expect(timeline.getByText("Call")).toBeOnTheScreen();
    expect(timeline.getByText("2 NOV 2026 · 11:30")).toBeOnTheScreen();
    expect(timeline.getByText("Wedding in December 2027, about 250 guests.")).toBeOnTheScreen();
    expect(timeline.getByText("Note")).toBeOnTheScreen();
  });

  it("logs an activity from the detail and sends it to the server", async () => {
    mockWindow.width = 1280;
    const bodies: unknown[] = [];
    const routes: Routes = {
      [`${LEAD_PATH}/activities`]: (init) => {
        if (init?.method === "POST") {
          bodies.push(JSON.parse(String(init.body)));
          return ok(activityFixture());
        }
        return ok({ items: [] });
      },
    };
    await renderDetail(detailFetch(leadFixture(), routes));
    await fireEvent.press(await screen.findByTestId("lead-activity-add"));
    await fireEvent.press(await screen.findByText("WhatsApp"));
    await fireEvent.press(screen.getByTestId("lead-activity-submit"));
    expect(await screen.findByText("Activity logged")).toBeOnTheScreen();
    expect(bodies).toEqual([{ activityType: "whatsapp" }]);
  });

  it("advances an owned lead one funnel stage from the record header", async () => {
    const owned = leadFixture({ ownerUserId: STAFF_USER_ID, ownerName: "Sameer Sales" });
    const bodies: unknown[] = [];
    const routes: Routes = {
      [LEAD_PATH]: (init) => {
        if (init?.method === "PATCH") {
          bodies.push(JSON.parse(String(init.body)));
          return ok({ ...owned, status: "contacted" });
        }
        return ok(owned);
      },
    };
    await renderDetail(detailFetch(owned, routes));
    const header = within(await screen.findByTestId("lead-header"));
    await fireEvent.press(await header.findByTestId("lead-advance"));
    expect(await screen.findByText("Moved to Contacted")).toBeOnTheScreen();
    expect(bodies).toEqual([{ status: "contacted" }]);
  });

  it("hides Advance on an unowned lead and points to assigning an owner first", async () => {
    // The server refuses a move past `new` without an owner, so the UI gates Advance on ownership.
    await renderDetail(detailFetch(leadFixture()));
    expect(await screen.findByTestId("lead-advance-needs-owner")).toBeOnTheScreen();
    expect(screen.queryByTestId("lead-advance")).toBeNull();
    expect(await screen.findByTestId("lead-assign-me")).toBeOnTheScreen();
  });

  it("assigns the unowned lead to the signed-in salesperson", async () => {
    const bodies: unknown[] = [];
    const routes: Routes = {
      [`${LEAD_PATH}/owner`]: (init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return ok(leadFixture({ ownerUserId: STAFF_USER_ID, ownerName: "Sameer Sales" }));
      },
    };
    await renderDetail(detailFetch(leadFixture(), routes));
    await fireEvent.press(await screen.findByTestId("lead-assign-me"));
    expect(await screen.findByText("Assigned to you")).toBeOnTheScreen();
    expect(bodies).toEqual([{ ownerUserId: STAFF_USER_ID }]);
  });

  it("hides the working actions on a terminal lead", async () => {
    const lead = leadFixture({
      status: "converted",
      convertedAccountId: ACCOUNT_ID,
      convertedAt: CONVERTED_AT,
    });
    await renderDetail(detailFetch(lead));
    expect(await screen.findByText("Converted to a client account")).toBeOnTheScreen();
    expect(screen.queryByTestId("lead-manage")).toBeNull();
    expect(screen.queryByTestId("lead-activity-add")).toBeNull();
  });
});

describe("LeadDetailScreen states", () => {
  it("shows the not-found state when the lead is gone or out of reach", async () => {
    await renderDetail(routedFetch({}));
    expect(await screen.findByText("Lead not found")).toBeOnTheScreen();
  });

  it("shows the offline state on a network failure", async () => {
    await renderDetail(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("asks to sign in again once the session has ended", async () => {
    await renderDetail(routedFetch({ [LEAD_PATH]: () => failure("unauthenticated", 401) }));
    expect(await screen.findByText("Sign in to view this lead")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});
