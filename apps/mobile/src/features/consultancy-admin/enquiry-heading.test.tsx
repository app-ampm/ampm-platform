import { renderWithProviders, screen, within } from "../../test/render";
import { detailFixture, STAFF_USER_ID } from "./consultancy-admin.test-utils";
import { EnquiryHeading } from "./enquiry-heading";

describe("EnquiryHeading — who holds it", () => {
  it("shows the gold Unassigned under the status while nobody holds the enquiry", async () => {
    await renderWithProviders(<EnquiryHeading enquiry={detailFixture()} />);
    const holder = screen.getByTestId("enquiry-heading-holder");
    expect(within(holder).getByText("Unassigned")).toBeOnTheScreen();
    expect(holder).toHaveProp("accessibilityLabel", "Unassigned");
  });

  it("names the holder, short on the chip and in full for a screen reader", async () => {
    const enquiry = detailFixture({
      assignedUserId: STAFF_USER_ID,
      assignedUserName: "Meera Iyer",
    });
    await renderWithProviders(<EnquiryHeading enquiry={enquiry} />);
    const holder = screen.getByTestId("enquiry-heading-holder");
    expect(within(holder).getByText("Meera I.")).toBeOnTheScreen();
    expect(holder).toHaveProp("accessibilityLabel", "Held by Meera Iyer");
    expect(screen.queryByText("Unassigned")).toBeNull();
  });
});
