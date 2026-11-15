import { act, fireEvent, screen, within } from "../../test/render";
import {
  agreementFixture,
  ENQUIRY_ID as AGREEMENT_ENQUIRY_ID,
} from "../consultancy-admin/commercial.fixtures";
import {
  ENQUIRY_ID,
  enquiryFixture,
  HOTEL_NAME,
} from "../consultancy-admin/consultancy-admin.test-utils";
import type * as RouterStub from "../portal/portal.test-router";
import { AccountDetailScreen } from "./account-detail-screen";
import {
  ACCOUNT_ID,
  accountContactViewFixture,
  accountDetailViewFixture,
  ok,
  planPublicViewFixture,
  renderWithApi,
  routedFetch,
  staffMeFixture,
  type FetchFn,
} from "./accounts.test-utils";

const mockPush = jest.fn();

jest.mock("expo-router", () =>
  jest
    .requireActual<typeof RouterStub>("../portal/portal.test-router")
    .expoRouterStub({ push: (href) => mockPush(href), back: jest.fn(), replace: jest.fn() }),
);

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const LEAD_ID = "018f0000-0000-7000-8000-0000000d0010";
const GUEST_CONTACT_ID = "018f0000-0000-7000-8000-0000000d0011";
const LOGIN_USER_ID = "018f0000-0000-7000-8000-0000000d0012";

type Roles = ReturnType<typeof staffMeFixture>["roles"];

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

/** The primary contact signs in; the father of the bride does not (no login, an email on file). */
const account = accountDetailViewFixture({
  leadId: LEAD_ID,
  contacts: [
    accountContactViewFixture({ userId: LOGIN_USER_ID }),
    accountContactViewFixture({
      id: GUEST_CONTACT_ID,
      name: "Anil Sharma",
      relation: "Father of the bride",
      email: "anil@example.com",
      isDecisionMaker: false,
    }),
  ],
});

function hubFetch(sent: Sent[], roles: Roles = ["SM"]): FetchFn {
  const record =
    (path: string, response: () => Response) =>
    (init: RequestInit | undefined): Response => {
      const method = init?.method ?? "GET";
      if (method !== "GET") {
        sent.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      }
      return response();
    };
  const contactPath = `/crm/accounts/${ACCOUNT_ID}/contacts/${GUEST_CONTACT_ID}`;
  const contact = account.contacts[1];
  return routedFetch({
    [`/crm/accounts/${ACCOUNT_ID}`]: record(`/crm/accounts/${ACCOUNT_ID}`, () => ok(account)),
    [`/crm/accounts/${ACCOUNT_ID}/contacts`]: record("contacts", () =>
      ok({ contact: accountContactViewFixture({ id: GUEST_CONTACT_ID }), inviteQueued: true }),
    ),
    [contactPath]: record(contactPath, () => ok({ id: GUEST_CONTACT_ID })),
    [`${contactPath}/invite`]: record("invite", () =>
      ok({ contact: { ...contact, userId: LOGIN_USER_ID }, inviteQueued: true }),
    ),
    "/crm/subscriptions": () => ok({ items: [], nextCursor: null }),
    "/crm/plans": () => ok({ items: [planPublicViewFixture()] }),
    "/me": () => ok(staffMeFixture(roles)),
    "/consultancy-admin/enquiries": () =>
      ok({ items: [enquiryFixture({ accountId: ACCOUNT_ID })], nextCursor: null }),
    "/crm/service-agreements": () =>
      ok({ items: [agreementFixture({ accountId: ACCOUNT_ID })], nextCursor: null }),
  });
}

async function renderHub(sent: Sent[] = [], roles: Roles = ["SM"]): Promise<void> {
  await renderWithApi(<AccountDetailScreen accountId={ACCOUNT_ID} />, hubFetch(sent, roles));
  expect(await screen.findByText("Anil Sharma")).toBeOnTheScreen();
}

beforeEach(() => mockPush.mockClear());

describe("the client hub (TW-13)", () => {
  it("lists the client's enquiries and agreements, each opening its enquiry", async () => {
    await renderHub();
    const enquiries = await screen.findByTestId("account-enquiries");
    await fireEvent.press(await within(enquiries).findByText(HOTEL_NAME));
    expect(mockPush).toHaveBeenCalledWith(`/enquiries/${ENQUIRY_ID}`);

    const agreements = await screen.findByTestId("account-agreements");
    await fireEvent.press(await within(agreements).findByText("Rate negotiation"));
    expect(mockPush).toHaveBeenCalledWith(`/enquiries/${AGREEMENT_ENQUIRY_ID}`);
  });

  it("links back to the lead the client came from", async () => {
    await renderHub();
    await fireEvent.press(await screen.findByTestId("account-lead-link"));
    expect(mockPush).toHaveBeenCalledWith(`/leads/${LEAD_ID}`);
  });

  it("edits the details, sending only what changed", async () => {
    const sent: Sent[] = [];
    await renderHub(sent);
    await fireEvent.press(await screen.findByTestId("account-edit-details"));
    await fireEvent.changeText(await screen.findByTestId("account-couple"), "Priya & Rohan");
    await fireEvent.press(screen.getByTestId("account-details-save"));
    expect(await screen.findByText("Details saved")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "PATCH",
        path: `/crm/accounts/${ACCOUNT_ID}`,
        body: { coupleNames: "Priya & Rohan" },
      },
    ]);
  });

  it("adds a contact and sends the portal invite with it", async () => {
    const sent: Sent[] = [];
    await renderHub(sent);
    await fireEvent.press(await screen.findByTestId("contact-add"));
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Arjun Mehta");
    await fireEvent.changeText(screen.getByTestId("contact-relation"), "Groom");
    await fireEvent.changeText(screen.getByTestId("contact-email"), "arjun@example.com");
    await fireEvent.press(screen.getByTestId("contact-invite"));
    await fireEvent.press(screen.getByTestId("contact-save"));
    expect(await screen.findByText("Contact added and invited")).toBeOnTheScreen();
    expect(sent[0]).toMatchObject({
      method: "POST",
      path: "contacts",
      body: { name: "Arjun Mehta", relation: "Groom", email: "arjun@example.com", invite: true },
    });
  });

  it("keeps a portal user's sign-in email and offers no removal", async () => {
    await renderHub();
    await fireEvent.press(await screen.findByLabelText("Edit Priya Sharma"));
    expect(await screen.findByTestId("contact-email")).toBeDisabled();
    expect(screen.getByTestId("contact-has-login")).toBeOnTheScreen();
    expect(screen.queryByTestId("contact-remove")).toBeNull();
  });

  it("invites an existing contact to the portal", async () => {
    const sent: Sent[] = [];
    await renderHub(sent);
    await fireEvent.press(await screen.findByLabelText("Edit Anil Sharma"));
    await fireEvent.press(await screen.findByTestId("contact-send-invite"));
    expect(await screen.findByText("Portal invite sent")).toBeOnTheScreen();
    expect(sent).toEqual([{ method: "POST", path: "invite", body: undefined }]);
  });

  it("removes a contact without a login after confirming", async () => {
    const sent: Sent[] = [];
    await renderHub(sent);
    await fireEvent.press(await screen.findByLabelText("Edit Anil Sharma"));
    await fireEvent.press(await screen.findByTestId("contact-remove"));
    await fireEvent.press(await screen.findByTestId("remove-contact-confirm"));
    expect(await screen.findByText("Contact removed")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "DELETE",
        path: `/crm/accounts/${ACCOUNT_ID}/contacts/${GUEST_CONTACT_ID}`,
        body: undefined,
      },
    ]);
  });

  it("leaves a read-only role reading: the enquiries show, no edit actions do", async () => {
    await renderHub([], ["HT"]);
    expect(await screen.findByTestId("account-enquiries")).toBeOnTheScreen();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByTestId("account-edit-details")).toBeNull();
    expect(screen.queryByTestId("contact-add")).toBeNull();
    expect(screen.queryByLabelText("Edit Anil Sharma")).toBeNull();
  });
});
