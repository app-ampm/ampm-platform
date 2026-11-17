import type { LeadView } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { jsonResponse } from "../../test/api";
import { fireEvent, screen, within } from "../../test/render";
import { LeadDetailScreen } from "./lead-detail-screen";
import {
  LEAD_ID,
  leadDetailFetch,
  leadFixture,
  ok,
  renderWithApi,
  staffMeFixture,
  type FetchFn,
} from "./sales.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 900, scale: 2, fontScale: 1 }),
}));

const LEAD_PATH = `/crm/leads/${LEAD_ID}`;
const ADD_LINE = "The portal invite goes by email. Add the couple's email to convert this lead.";
const inviteLine = (email: string): string =>
  `Creates the client account and invites ${email} to the client portal.`;

interface EditableLead {
  readonly fetch: FetchFn;
  readonly patches: unknown[];
}

/**
 * A lead whose detail answers like the API: GET returns the lead as it stands and PATCH saves the
 * email onto it (or answers with `refusal`), so the refetch after a save reads it back. `roles` is
 * who is signed in (Sales by default, who may edit a lead).
 */
function editableLead(
  overrides: Partial<LeadView>,
  { refusal, roles }: { refusal?: Response; roles?: Parameters<typeof staffMeFixture>[0] } = {},
): EditableLead {
  let lead: LeadView = leadFixture(overrides);
  const patches: unknown[] = [];
  const fetch = leadDetailFetch(lead, {
    [LEAD_PATH]: (init) => {
      if (init?.method !== "PATCH") return ok(lead);
      const body: unknown = JSON.parse(String(init.body));
      patches.push(body);
      if (refusal) return refusal;
      const isEmailEdit = typeof body === "object" && body !== null && "email" in body;
      lead = { ...lead, email: isEmailEdit && typeof body.email === "string" ? body.email : null };
      return ok(lead);
    },
    "/me": () => ok(staffMeFixture(roles)),
  });
  return { fetch, patches };
}

async function render(lead: EditableLead): Promise<void> {
  await renderWithApi(<LeadDetailScreen leadId={LEAD_ID} />, lead.fetch);
}

async function typeEmail(value: string): Promise<void> {
  await fireEvent.changeText(await screen.findByTestId("lead-invite-email"), value);
}

describe("LeadInviteEmail: a lead without an email", () => {
  it("asks Sales for the couple's email in place of the invite", async () => {
    await render(editableLead({ email: null }));
    const invite = within(await screen.findByTestId("lead-invite"));
    expect(await invite.findByText(ADD_LINE)).toBeOnTheScreen();
    expect(invite.getByRole("button", { name: "Save email" })).toBeOnTheScreen();
    expect(invite.queryByText("Create account and invite")).toBeNull();
  });

  it("only tells a role that cannot edit leads that the email is missing", async () => {
    await render(editableLead({ email: null }, { roles: ["HT"] }));
    expect(await screen.findByText("Add an email before converting this lead")).toBeOnTheScreen();
    expect(screen.getByText("Sales adds the couple's email here.")).toBeOnTheScreen();
    expect(screen.queryByTestId("lead-invite-email")).toBeNull();
  });

  it("refuses an address that is not an email, without calling the API", async () => {
    const lead = editableLead({ email: null });
    await render(lead);
    await typeEmail("yogesh@");
    await fireEvent.press(screen.getByRole("button", { name: "Save email" }));
    expect(await screen.findByText("Enter a valid email address")).toBeOnTheScreen();
    expect(lead.patches).toEqual([]);
    await typeEmail("yogesh@example");
    expect(screen.queryByText("Enter a valid email address")).toBeNull();
  });

  it("saves the email on the lead, then offers the invite to that address", async () => {
    const lead = editableLead({ email: null });
    await render(lead);
    await typeEmail("  Yogesh@Example.com ");
    await fireEvent.press(screen.getByRole("button", { name: "Save email" }));
    expect(await screen.findByText(inviteLine("yogesh@example.com"))).toBeOnTheScreen();
    expect(lead.patches).toEqual([{ email: "yogesh@example.com" }]);
    const invite = within(screen.getByTestId("lead-invite"));
    expect(invite.getByRole("button", { name: "Create account and invite" })).toBeOnTheScreen();
    expect(screen.getByText("Email saved")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(uiCopy.dismiss));
  });

  it("keeps what was typed and gives the server's reason when the save is refused", async () => {
    const refusal = jsonResponse(
      { error: { code: "conflict", message: "A closed lead is read-only" } },
      409,
    );
    const lead = editableLead({ email: null }, { refusal });
    await render(lead);
    await typeEmail("yogesh@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Save email" }));
    expect(await screen.findByText("A closed lead is read-only")).toBeOnTheScreen();
    expect(lead.patches).toHaveLength(1);
    expect(screen.getByTestId("lead-invite-email")).toHaveDisplayValue("yogesh@example.com");
    expect(screen.queryByText("Create account and invite")).toBeNull();
    await fireEvent.press(screen.getByLabelText(uiCopy.dismiss));
  });
});

describe("LeadInviteEmail: correcting the email before the invite", () => {
  it("corrects a mistyped email, then invites the corrected address", async () => {
    const lead = editableLead({ email: "yogseh@example.com" });
    await render(lead);
    await fireEvent.press(await screen.findByRole("button", { name: "Change email" }));
    expect(screen.getByTestId("lead-invite-email")).toHaveDisplayValue("yogseh@example.com");
    await typeEmail("yogesh@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Save email" }));
    expect(await screen.findByText(inviteLine("yogesh@example.com"))).toBeOnTheScreen();
    expect(lead.patches).toEqual([{ email: "yogesh@example.com" }]);
    await fireEvent.press(screen.getByLabelText(uiCopy.dismiss));
  });

  it("goes back to the invite on Cancel without saving anything", async () => {
    const lead = editableLead({ email: "yogesh@example.com" });
    await render(lead);
    await fireEvent.press(await screen.findByRole("button", { name: "Change email" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(inviteLine("yogesh@example.com"))).toBeOnTheScreen();
    expect(screen.queryByTestId("lead-invite-email")).toBeNull();
    expect(lead.patches).toEqual([]);
  });

  it("offers no correction to a role that cannot edit leads", async () => {
    await render(editableLead({ email: "yogesh@example.com" }, { roles: ["HT"] }));
    expect(await screen.findByText(inviteLine("yogesh@example.com"))).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Change email" })).toBeNull();
  });
});
