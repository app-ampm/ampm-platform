import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor, within } from "../../test/render";
import {
  ENQUIRY_ID,
  failure,
  ok,
  proposalFixture,
  renderWithApi,
  type Handler,
} from "./commercial.fixtures";
import { ProposalCreateForm } from "./proposal-create-form";

const CREATE = "POST /consultancy-admin/proposals";

async function renderForm(answer: Handler = () => ok(proposalFixture())) {
  const onDone = jest.fn();
  const sent = await renderWithApi(<ProposalCreateForm enquiryId={ENQUIRY_ID} onDone={onDone} />, {
    [CREATE]: answer,
  });
  return { onDone, sent };
}

const submitButton = () => screen.getByRole("button", { name: "Draft proposal" });

async function typeTotals(client: string, internal: string): Promise<void> {
  await fireEvent.changeText(screen.getByTestId("proposal-client-total"), client);
  await fireEvent.changeText(screen.getByTestId("proposal-internal-total"), internal);
}

/** Fills line 1 completely except its visibility, which the test chooses. */
async function fillFirstLine(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: "Add line" }));
  const row = screen.getByTestId("proposal-line-1");
  await fireEvent.press(within(row).getByRole("button", { name: "Room rate" }));
  await fireEvent.changeText(screen.getByTestId("proposal-line-1-description"), "Deluxe rooms");
  await fireEvent.changeText(screen.getByTestId("proposal-line-1-quantity"), "60");
  await fireEvent.changeText(screen.getByTestId("proposal-line-1-unit"), "12000");
  await fireEvent.changeText(screen.getByTestId("proposal-line-1-total"), "720000");
}

describe("ProposalCreateForm", () => {
  it("keeps the submit disabled until both totals parse, then drafts them in paise", async () => {
    const { onDone, sent } = await renderForm();
    expect(submitButton()).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("proposal-client-total"), "18,50,000");
    expect(submitButton()).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("proposal-internal-total"), "1700000");
    expect(submitButton()).toBeEnabled();
    // The peacock confirm: the enquiry screen's one gold action stays its next pipeline step.
    expect(String(submitButton().props.className)).toContain("bg-highlight");
    expect(String(submitButton().props.className)).not.toContain("bg-brand");
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent).toContainEqual({
      method: "POST",
      path: "/consultancy-admin/proposals",
      body: {
        enquiryId: ENQUIRY_ID,
        validUntil: null,
        clientTotal: { minor: 185_000_000, currency: "INR" },
        internalTotal: { minor: 170_000_000, currency: "INR" },
        lines: [],
      },
    });
    expect(await screen.findByText("Proposal drafted")).toBeOnTheScreen();
  });

  it("types the internal total inside the InternalPanel, the client total outside it", async () => {
    await renderForm();
    const panel = screen.getByTestId("proposal-form-internal");
    expect(within(panel).getByText(uiCopy.internalPanel.label)).toBeOnTheScreen();
    expect(within(panel).getByTestId("proposal-internal-total")).toBeOnTheScreen();
    expect(within(panel).queryByTestId("proposal-client-total")).toBeNull();
  });

  it("shows the gold error naming the field once it is left, and keeps what was typed", async () => {
    await renderForm();
    const field = screen.getByTestId("proposal-client-total");
    await fireEvent.changeText(field, "18 lakh");
    expect(screen.queryByRole("alert")).toBeNull();
    await fireEvent(field, "blur");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the client total in rupees, such as 25000",
    );
    expect(field).toHaveDisplayValue("18 lakh");
    expect(field).toHaveProp("aria-invalid", true);
  });

  it("fails closed until a line's visibility is chosen, then adds up the client-visible lines", async () => {
    const { onDone, sent } = await renderForm();
    await typeTotals("720000", "650000");
    await fillFirstLine();
    expect(submitButton()).toBeDisabled();
    expect(screen.queryByTestId("proposal-lines-client-total")).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Client sees it" }));
    const total = screen.getByTestId("proposal-lines-client-total");
    expect(within(total).getByText("₹7,20,000")).toBeOnTheScreen();
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent.at(-1)?.body).toMatchObject({
      lines: [
        {
          itemType: "room_rate",
          description: "Deluxe rooms",
          quantity: 60,
          unitAmount: { minor: 1_200_000, currency: "INR" },
          totalAmount: { minor: 72_000_000, currency: "INR" },
          clientVisible: true,
        },
      ],
    });
  });

  it("moves a line marked internal only into an InternalPanel, out of the client sum", async () => {
    const { sent, onDone } = await renderForm();
    await typeTotals("720000", "650000");
    await fillFirstLine();
    await fireEvent.press(screen.getByRole("tab", { name: "Internal only" }));
    const row = screen.getByTestId("proposal-line-1");
    expect(within(row).getByText(uiCopy.internalPanel.label)).toBeOnTheScreen();
    expect(screen.queryByTestId("proposal-lines-client-total")).toBeNull();
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent.at(-1)?.body).toMatchObject({ lines: [{ clientVisible: false }] });
  });

  it("removes a line", async () => {
    await renderForm();
    await fireEvent.press(screen.getByRole("button", { name: "Add line" }));
    await fireEvent.press(screen.getByRole("button", { name: "Remove line 1" }));
    expect(screen.queryByTestId("proposal-line-1")).toBeNull();
  });

  it("toasts the API's reason when the draft is refused, and stays open", async () => {
    const { onDone } = await renderForm(() => failure("forbidden", 403));
    await typeTotals("1850000", "1700000");
    await fireEvent.press(submitButton());
    expect(await screen.findByText("forbidden")).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("cancels without sending anything", async () => {
    const { onDone, sent } = await renderForm();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(0);
  });
});
