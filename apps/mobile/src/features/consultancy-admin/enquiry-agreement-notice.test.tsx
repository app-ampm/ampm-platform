import { fireEvent, screen, waitFor } from "../../test/render";
import { agreementFixture, ENQUIRY_ID, ok, pageOf, renderWithApi } from "./commercial.fixtures";
import { EnquiryAgreementNotice } from "./enquiry-agreement-notice";

const LIST = `GET /crm/service-agreements?hotelEnquiryId=${ENQUIRY_ID}`;

describe("EnquiryAgreementNotice", () => {
  it("tells the team a client-accepted agreement needs activating, and opens Booking", async () => {
    const onOpenBooking = jest.fn();
    await renderWithApi(
      <EnquiryAgreementNotice enquiryId={ENQUIRY_ID} onOpenBooking={onOpenBooking} blur={false} />,
      {
        [LIST]: () =>
          ok(
            pageOf([
              agreementFixture({
                status: "accepted",
                acceptedByUserId: "018f0000-0000-7000-8000-0000000000d2",
              }),
            ]),
          ),
      },
    );
    expect(
      await screen.findByText("The client accepted the Rate negotiation agreement"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Activate it in Booking"));
    expect(onOpenBooking).toHaveBeenCalledTimes(1);
  });

  it("says nothing while no accepted agreement waits", async () => {
    const sent = await renderWithApi(
      <EnquiryAgreementNotice enquiryId={ENQUIRY_ID} blur={false} />,
      {
        [LIST]: () =>
          ok(
            pageOf([agreementFixture({ status: "sent" }), agreementFixture({ status: "active" })]),
          ),
      },
    );
    // The list has been read and settled (React Query resolves before the next assertion's tick).
    await waitFor(() => expect(sent).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId("enquiry-agreement-notice")).toBeNull());
  });
});
