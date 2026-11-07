import { fireEvent, screen, waitFor } from "../../test/render";
import { AgreementCreateForm } from "./agreement-create-form";
import {
  ACCOUNT_ID,
  agreementFixture,
  ENQUIRY_ID,
  failure,
  ok,
  pending,
  renderWithApi,
  SERVICE_TYPE_ID,
  type Handler,
} from "./commercial.fixtures";

const SERVICE_TYPES = "GET /crm/service-types";
const CREATE = "POST /crm/service-agreements";
const CATALOGUE = {
  items: [
    {
      id: SERVICE_TYPE_ID,
      serviceKey: "negotiation",
      name: "Rate negotiation",
      category: "hotel_assistance",
    },
  ],
};

async function renderForm(catalogue: Handler = () => ok(CATALOGUE)) {
  const onDone = jest.fn();
  const sent = await renderWithApi(
    <AgreementCreateForm enquiryId={ENQUIRY_ID} accountId={ACCOUNT_ID} onDone={onDone} />,
    { [SERVICE_TYPES]: catalogue, [CREATE]: () => ok(agreementFixture()) },
  );
  return { onDone, sent };
}

const submitButton = () => screen.getByRole("button", { name: "Draft agreement" });

describe("AgreementCreateForm", () => {
  it("drafts for the enquiry's account once the service, scope, fee and structure are given", async () => {
    const { onDone, sent } = await renderForm();
    await fireEvent.press(await screen.findByRole("button", { name: "Rate negotiation" }));
    await fireEvent.changeText(screen.getByTestId("agreement-scope"), " Negotiate rates ");
    await fireEvent.changeText(screen.getByTestId("agreement-fee"), "25,000");
    // The fee structure is chosen on purpose, never defaulted.
    expect(submitButton()).toBeDisabled();
    await fireEvent.press(screen.getByRole("tab", { name: "Fixed" }));
    expect(submitButton()).toBeEnabled();
    await fireEvent.press(submitButton());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(sent).toContainEqual({
      method: "POST",
      path: "/crm/service-agreements",
      body: {
        accountId: ACCOUNT_ID,
        serviceTypeId: SERVICE_TYPE_ID,
        hotelEnquiryId: ENQUIRY_ID,
        scopeText: "Negotiate rates",
        fee: { minor: 2_500_000, currency: "INR" },
        feeStructure: "fixed",
        termsVersion: null,
      },
    });
  });

  it("marks the chosen service as selected for screen readers", async () => {
    await renderForm();
    const chip = await screen.findByRole("button", { name: "Rate negotiation" });
    await fireEvent.press(chip);
    expect(screen.getByRole("button", { name: "Rate negotiation" })).toBeSelected();
  });

  it("names the scope when it is left blank", async () => {
    await renderForm();
    await screen.findByRole("button", { name: "Rate negotiation" });
    await fireEvent(screen.getByTestId("agreement-scope"), "blur");
    expect(screen.getByRole("alert")).toHaveTextContent("Describe the scope of the service");
  });

  it("holds a placeholder while the catalogue loads", async () => {
    await renderForm(pending);
    // The placeholder is hidden from screen readers (the label above names the field), so opt in.
    expect(
      screen.getByTestId("service-types-loading", { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it("says when the catalogue cannot load", async () => {
    await renderForm(() => failure("internal", 500));
    expect(await screen.findByText("Could not load the service catalogue.")).toBeOnTheScreen();
  });

  it("says when no service types are configured", async () => {
    await renderForm(() => ok({ items: [] }));
    expect(await screen.findByText("No service types are configured yet.")).toBeOnTheScreen();
  });
});
