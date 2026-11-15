import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import {
  ACCOUNT_ID,
  agreementFixture,
  CLIENT_LINE,
  ENQUIRY_ID,
  failure,
  ok,
  pageOf,
  pending,
  PROPOSAL_ID,
  proposalFixture,
  proposalWithoutGrant,
  renderWithApi,
} from "./commercial.fixtures";
import { AgreementSection, ProposalsSection } from "./enquiry-commercial";

const PROPOSALS = `GET /consultancy-admin/proposals?enquiryId=${ENQUIRY_ID}`;
const AGREEMENTS = `GET /crm/service-agreements?hotelEnquiryId=${ENQUIRY_ID}`;

function renderProposals(answer: () => Response | Promise<Response>, extra = {}) {
  return renderWithApi(<ProposalsSection enquiryId={ENQUIRY_ID} />, {
    [PROPOSALS]: answer,
    ...extra,
  });
}

describe("ProposalsSection", () => {
  it("keeps the client total and client lines on the card, every internal figure in the InternalPanel", async () => {
    await renderProposals(() => ok(pageOf([proposalFixture()])));
    const card = await screen.findByTestId(`proposal-${PROPOSAL_ID}`);
    expect(within(card).getByText("Proposal, version 1")).toBeOnTheScreen();
    expect(within(card).getByText("Draft")).toBeOnTheScreen();
    expect(within(card).getByText("₹18,50,000")).toBeOnTheScreen();
    expect(within(card).getByText("Deluxe rooms, 3 nights")).toBeOnTheScreen();
    expect(within(card).getByText("₹7,20,000")).toBeOnTheScreen();

    const internal = within(card).getByTestId(`proposal-internal-${PROPOSAL_ID}`);
    expect(within(internal).getByText(uiCopy.internalPanel.label)).toBeOnTheScreen();
    expect(within(internal).getByText("₹17,00,000")).toBeOnTheScreen();
    expect(within(internal).getByText("₹1,50,000")).toBeOnTheScreen();
    expect(within(internal).getByText("Hotel commission")).toBeOnTheScreen();
    // Nothing internal leaks onto the card, and nothing client-facing hides in the panel.
    expect(within(card).getAllByText("₹17,00,000")).toHaveLength(1);
    expect(within(card).getAllByText("Hotel commission")).toHaveLength(1);
    expect(within(internal).queryByText("Deluxe rooms, 3 nights")).toBeNull();
  });

  it("draws no internal panel for a reader without the internal-amount grant", async () => {
    await renderProposals(() => ok(pageOf([proposalWithoutGrant()])));
    expect(await screen.findByText("₹18,50,000")).toBeOnTheScreen();
    expect(screen.queryByTestId(`proposal-internal-${PROPOSAL_ID}`)).toBeNull();
    expect(screen.queryByText(uiCopy.internalPanel.label)).toBeNull();
  });

  it("shares a draft with the client, then offers a new version", async () => {
    let isShared = false;
    const sent = await renderProposals(
      () => ok(pageOf([proposalFixture({ status: isShared ? "shared" : "draft" })])),
      {
        [`POST /consultancy-admin/proposals/${PROPOSAL_ID}/share`]: () => {
          isShared = true;
          return ok(proposalFixture({ status: "shared" }));
        },
      },
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Share version 1 with client" }),
    );
    // Sharing refreshes the proposals: the card now waits on the client and offers a new version.
    expect(await screen.findByRole("button", { name: "Revise as version 2" })).toBeOnTheScreen();
    expect(sent).toContainEqual({
      method: "POST",
      path: `/consultancy-admin/proposals/${PROPOSAL_ID}/share`,
      body: undefined,
    });
  });

  it("offers a new version, not a share or an edit, once the proposal is with the client", async () => {
    await renderProposals(() => ok(pageOf([proposalFixture({ status: "shared" })])));
    expect(await screen.findByText("Shared (awaiting client)")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Revise as version 2" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Share version 1 with client" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit draft" })).toBeNull();
    // A proposal stands, so a second one cannot be started beside it (the API would refuse it).
    expect(screen.queryByRole("button", { name: "New proposal" })).toBeNull();
  });

  it("edits a draft in place: the saved terms prefilled, the whole draft sent back", async () => {
    let saved = false;
    const sent = await renderProposals(
      () =>
        ok(
          pageOf([
            proposalFixture(saved ? { clientTotal: { minor: 190_000_000, currency: "INR" } } : {}),
          ]),
        ),
      {
        [`PATCH /consultancy-admin/proposals/${PROPOSAL_ID}`]: () => {
          saved = true;
          return ok(proposalFixture());
        },
      },
    );
    await fireEvent.press(await screen.findByRole("button", { name: "Edit draft" }));
    const form = screen.getByTestId(`proposal-edit-form-${PROPOSAL_ID}`);
    expect(within(form).getByText("Edit version 1")).toBeOnTheScreen();
    expect(within(form).getByTestId("proposal-client-total")).toHaveDisplayValue("1850000");
    expect(within(form).getByTestId("proposal-internal-total")).toHaveDisplayValue("1700000");
    expect(within(form).getByTestId("proposal-valid-until")).toHaveDisplayValue("2027-01-31");
    expect(within(form).getByTestId("proposal-line-1-description")).toHaveDisplayValue(
      "Deluxe rooms, 3 nights",
    );

    await fireEvent.changeText(within(form).getByTestId("proposal-client-total"), "1900000");
    await fireEvent.press(within(form).getByRole("button", { name: "Save changes" }));

    // The form closes on the refreshed card, which carries the new figure.
    expect(await screen.findByText("₹19,00,000")).toBeOnTheScreen();
    expect(screen.queryByTestId(`proposal-edit-form-${PROPOSAL_ID}`)).toBeNull();
    const patch = sent.find((request) => request.method === "PATCH");
    expect(patch?.body).toEqual({
      validUntil: "2027-01-31",
      clientTotal: { minor: 190_000_000, currency: "INR" },
      internalTotal: { minor: 170_000_000, currency: "INR" },
      lines: [
        {
          itemType: "room_rate",
          description: "Deluxe rooms, 3 nights",
          quantity: 60,
          unitAmount: { minor: 1_200_000, currency: "INR" },
          totalAmount: { minor: 72_000_000, currency: "INR" },
          clientVisible: true,
        },
        {
          itemType: "service_charge",
          description: "Hotel commission",
          quantity: 1,
          unitAmount: { minor: 9_000_000, currency: "INR" },
          totalAmount: { minor: 9_000_000, currency: "INR" },
          clientVisible: false,
        },
      ],
    });
  });

  it("leaves the internal total alone when the reader cannot see it", async () => {
    const sent = await renderProposals(() => ok(pageOf([proposalWithoutGrant()])), {
      [`PATCH /consultancy-admin/proposals/${PROPOSAL_ID}`]: () => ok(proposalWithoutGrant()),
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Edit draft" }));
    expect(screen.queryByTestId("proposal-internal-total")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    const patch = sent.find((request) => request.method === "PATCH");
    expect(patch?.body).not.toHaveProperty("internalTotal");
  });

  it("opens the version a revision drafts straight in the edit form", async () => {
    const V2_ID = "018f0000-0000-7000-8000-0000000000f9";
    let revised = false;
    const versionTwo = proposalFixture({
      id: V2_ID,
      versionNumber: 2,
      supersedesProposalId: PROPOSAL_ID,
      lines: [{ ...CLIENT_LINE, proposalId: V2_ID }],
    });
    await renderProposals(
      () =>
        ok(
          pageOf(
            revised
              ? [proposalFixture({ status: "superseded" }), versionTwo]
              : [proposalFixture({ status: "revision_requested" })],
          ),
        ),
      {
        [`POST /consultancy-admin/proposals/${PROPOSAL_ID}/revise`]: () => {
          revised = true;
          return ok(versionTwo);
        },
      },
    );
    expect(
      await screen.findByText("The client asked for changes · revise it as a new version"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Revise as version 2" }));
    expect(await screen.findByTestId(`proposal-edit-form-${V2_ID}`)).toBeOnTheScreen();
    expect(screen.getByText("Edit version 2")).toBeOnTheScreen();
    // Version 1 is history now: folded under the current one until asked for.
    expect(screen.queryByTestId(`proposal-${PROPOSAL_ID}`)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Show 1 earlier version" }));
    expect(screen.getByTestId(`proposal-${PROPOSAL_ID}`)).toBeOnTheScreen();
    expect(screen.getByText("Replaced by a later version")).toBeOnTheScreen();
  });

  it("says what creates the first proposal and opens the form", async () => {
    await renderProposals(() => ok(pageOf([])));
    expect(
      await screen.findByText(
        "No proposal yet. Once the hotel has quoted, draft the client's offer.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Draft a proposal" }));
    expect(screen.getByTestId("proposal-create-form")).toBeOnTheScreen();
  });

  it("offers a fresh proposal once the client has declined the last one", async () => {
    await renderProposals(() => ok(pageOf([proposalFixture({ status: "declined" })])));
    expect(await screen.findByRole("button", { name: "New proposal" })).toBeOnTheScreen();
  });

  it("shows a card-sized placeholder while the proposals load", async () => {
    await renderProposals(pending);
    expect(screen.getByTestId("proposals-loading")).toBeOnTheScreen();
  });

  it("shows the retryable error state when the proposals fail to load", async () => {
    await renderProposals(() => failure("internal", 500));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });
});

describe("AgreementSection", () => {
  function renderAgreements(answer: () => Response | Promise<Response>) {
    return renderWithApi(<AgreementSection enquiryId={ENQUIRY_ID} accountId={ACCOUNT_ID} />, {
      [AGREEMENTS]: answer,
    });
  }

  it("shows the service, its scope, the client fee and the next moves", async () => {
    await renderAgreements(() => ok(pageOf([agreementFixture()])));
    expect(await screen.findByText("Rate negotiation")).toBeOnTheScreen();
    expect(
      screen.getByText("Negotiate the room and venue rates and hold 60 rooms"),
    ).toBeOnTheScreen();
    expect(screen.getByText("₹25,000")).toBeOnTheScreen();
    expect(screen.getByText("Fee · Fixed")).toBeOnTheScreen();
    expect(screen.getByText("Terms 2026-11")).toBeOnTheScreen();
    expect(screen.queryByText(uiCopy.internalPanel.label)).toBeNull();
  });

  it("says what creates the first agreement", async () => {
    await renderAgreements(() => ok(pageOf([])));
    expect(
      await screen.findByText("No agreement yet. Draft one when the client asks for a service."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "New agreement" })).toBeOnTheScreen();
  });

  it("shows the offline state when the network is down", async () => {
    await renderAgreements(() => Promise.reject(new TypeError("Network request failed")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });
});
