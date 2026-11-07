import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor, within } from "../../test/render";
import { ENQUIRY_ID, ok, renderWithApi, VISIT_CREATED } from "./commercial.fixtures";
import { VisitCreateForm } from "./visit-create-form";

const CREATE = "POST /consultancy-admin/site-visits";

async function renderForm() {
  const onDone = jest.fn();
  const sent = await renderWithApi(<VisitCreateForm enquiryId={ENQUIRY_ID} onDone={onDone} />, {
    [CREATE]: () => ok(VISIT_CREATED),
  });
  return { onDone, sent };
}

const submitButton = () => screen.getByRole("button", { name: "Schedule visit" });

describe("VisitCreateForm", () => {
  it("schedules on a real date, with the internal attendees typed inside the InternalPanel", async () => {
    const { onDone, sent } = await renderForm();
    const panel = screen.getByTestId("visit-form-internal");
    expect(within(panel).getByText(uiCopy.internalPanel.label)).toBeOnTheScreen();
    expect(submitButton()).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("visit-date"), "2027-01-20");
    await fireEvent.changeText(within(panel).getByTestId("visit-attendees"), " Couple, planner ");
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent).toContainEqual({
      method: "POST",
      path: "/consultancy-admin/site-visits",
      body: {
        enquiryId: ENQUIRY_ID,
        scheduledAt: "2027-01-20T00:00:00.000Z",
        attendeesText: "Couple, planner",
      },
    });
    expect(await screen.findByText("Site visit scheduled")).toBeOnTheScreen();
  });

  it("asks for the visit date once the field is left empty", async () => {
    await renderForm();
    await fireEvent(screen.getByTestId("visit-date"), "blur");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the visit date");
    expect(submitButton()).toBeDisabled();
  });
});
