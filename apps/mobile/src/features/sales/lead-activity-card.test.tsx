import { failure, pendingFetch, renderWithApi } from "../../test/api";
import { screen, waitFor } from "../../test/render";
import { LeadActivityCard } from "./lead-activity-card";

const LEAD_ID = "018f0000-0000-7000-8000-0000000000c1";

describe("LeadActivityCard (T3)", () => {
  it("holds the timeline's place with a skeleton while the activities load", async () => {
    await renderWithApi(<LeadActivityCard leadId={LEAD_ID} />, pendingFetch);
    expect(screen.getByText("Activity")).toBeOnTheScreen();
    expect(screen.getByTestId("lead-activity-loading")).toBeOnTheScreen();
  });

  it("drops the timeline quietly when the activities fail: it is secondary context", async () => {
    await renderWithApi(<LeadActivityCard leadId={LEAD_ID} />, () =>
      Promise.resolve(failure("internal", 500)),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("lead-activity-loading")).not.toBeOnTheScreen(),
    );
    expect(screen.getByText("Activity")).toBeOnTheScreen();
    expect(screen.queryByTestId("lead-activity-timeline")).not.toBeOnTheScreen();
  });
});
