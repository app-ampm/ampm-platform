import type { ServiceAgreementClientView } from "@ampm/core";

import { fireEvent, screen, waitFor } from "../../test/render";
import { ok, renderWithApi } from "../consultancy-admin/commercial.fixtures";
import { ClientAgreementCard } from "./client-agreement-card";

const AGREEMENT_ID = "018f0000-0000-7000-8000-0000000000d4";
const STAMP = "2026-11-01T10:00:00.000Z";

function clientAgreement(
  overrides: Partial<ServiceAgreementClientView> = {},
): ServiceAgreementClientView {
  return {
    id: AGREEMENT_ID,
    serviceKey: "negotiation",
    serviceName: "Rate negotiation",
    category: "hotel_assistance",
    hotelEnquiryId: "018f0000-0000-7000-8000-0000000000e1",
    projectId: null,
    scopeText: "Negotiate the room and venue rates and hold 60 rooms",
    fee: { minor: 2_500_000, currency: "INR" },
    feeStructure: "fixed",
    termsVersion: "2026-11",
    status: "sent",
    acceptedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

describe("ClientAgreementCard", () => {
  it("accepts only once the client agrees to the scope, fee and terms", async () => {
    const sent = await renderWithApi(<ClientAgreementCard agreement={clientAgreement()} />, {
      [`POST /crm/portal/service-agreements/${AGREEMENT_ID}/accept`]: () =>
        ok(clientAgreement({ status: "accepted" })),
    });
    expect(screen.getByText("Fixed fee")).toBeOnTheScreen();
    const accept = screen.getByRole("button", { name: "Accept agreement" });
    expect(accept).toBeDisabled();
    await fireEvent.press(
      screen.getByRole("checkbox", {
        name: "I agree to this scope, the fee and AMPM's terms (terms 2026-11)",
      }),
    );
    expect(accept).toBeEnabled();
    await fireEvent.press(accept);
    await waitFor(() =>
      expect(sent).toContainEqual({
        method: "POST",
        path: `/crm/portal/service-agreements/${AGREEMENT_ID}/accept`,
        body: { termsAccepted: true },
      }),
    );
  });

  it("says AMPM will activate an accepted agreement, and that an active one is under way", async () => {
    await renderWithApi(
      <ClientAgreementCard agreement={clientAgreement({ status: "accepted" })} />,
      {},
    );
    expect(screen.getByText("Accepted. AMPM will activate it shortly.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Accept agreement" })).toBeNull();
  });
});
