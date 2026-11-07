import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, within } from "../../test/render";
import {
  ACCOUNT_ID,
  agreementFixture,
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
    expect(await screen.findByRole("button", { name: "Revise (new version)" })).toBeOnTheScreen();
    expect(sent).toContainEqual({
      method: "POST",
      path: `/consultancy-admin/proposals/${PROPOSAL_ID}/share`,
      body: undefined,
    });
  });

  it("offers a new version, not a share, once the proposal is with the client", async () => {
    await renderProposals(() => ok(pageOf([proposalFixture({ status: "shared" })])));
    expect(await screen.findByText("Shared (awaiting client)")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Revise (new version)" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Share version 1 with client" })).toBeNull();
  });

  it("says what creates the first proposal and opens the form", async () => {
    await renderProposals(() => ok(pageOf([])));
    expect(
      await screen.findByText("No proposal yet. Draft one once the hotel has quoted."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "New proposal" }));
    expect(screen.getByTestId("proposal-create-form")).toBeOnTheScreen();
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
