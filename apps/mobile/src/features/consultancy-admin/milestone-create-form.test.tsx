import { fireEvent, screen, waitFor } from "../../test/render";
import { ENQUIRY_ID, MILESTONE_CREATED, ok, renderWithApi } from "./commercial.fixtures";
import { MilestoneCreateForm } from "./milestone-create-form";

const CREATE = "POST /consultancy-admin/booking-milestones";

async function renderForm() {
  const onDone = jest.fn();
  const sent = await renderWithApi(<MilestoneCreateForm enquiryId={ENQUIRY_ID} onDone={onDone} />, {
    [CREATE]: () => ok(MILESTONE_CREATED),
  });
  return { onDone, sent };
}

const submitButton = () => screen.getByRole("button", { name: "Add milestone" });

describe("MilestoneCreateForm", () => {
  it("needs only the type; the due date and amount are optional", async () => {
    const { onDone, sent } = await renderForm();
    expect(submitButton()).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Advance payment" }));
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent).toContainEqual({
      method: "POST",
      path: "/consultancy-admin/booking-milestones",
      body: {
        enquiryId: ENQUIRY_ID,
        milestoneType: "advance_paid",
        dueAt: null,
        amount: null,
        contractId: null,
        documentId: null,
      },
    });
  });

  it("refuses an impossible due date with a gold line, then sends a real one at midnight UTC", async () => {
    const { onDone, sent } = await renderForm();
    await fireEvent.press(screen.getByRole("button", { name: "Balance due" }));
    const due = screen.getByTestId("milestone-due");
    await fireEvent.changeText(due, "2027-02-30");
    await fireEvent(due, "blur");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the due date as YYYY-MM-DD");
    expect(submitButton()).toBeDisabled();
    await fireEvent.changeText(due, "2027-01-31");
    await fireEvent.changeText(screen.getByTestId("milestone-amount"), "2,50,000");
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent.at(-1)?.body).toMatchObject({
      milestoneType: "balance_due",
      dueAt: "2027-01-31T00:00:00.000Z",
      amount: { minor: 25_000_000, currency: "INR" },
    });
  });
});
