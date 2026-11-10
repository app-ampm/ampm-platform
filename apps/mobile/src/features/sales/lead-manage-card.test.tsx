import type { LeadView } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { LeadManageCard } from "./lead-manage-card";
import {
  LEAD_ID,
  leadFixture,
  ok,
  renderWithApi,
  routedFetch,
  staffMeFixture,
  type FetchFn,
} from "./sales.test-utils";

const LEAD_PATH = `/crm/leads/${LEAD_ID}`;
type Routes = Parameters<typeof routedFetch>[0];

function manageFetch(routes: Routes = {}): FetchFn {
  return routedFetch({ "/me": () => ok(staffMeFixture()), ...routes });
}

async function renderCard(lead: LeadView, routes: Routes = {}): Promise<void> {
  await renderWithApi(<LeadManageCard lead={lead} />, manageFetch(routes));
}

describe("LeadManageCard — close and merge", () => {
  it("closes a lead with a required reason", async () => {
    const bodies: unknown[] = [];
    await renderCard(leadFixture(), {
      [LEAD_PATH]: (init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return ok(leadFixture({ status: "closed", closedReason: "Chose another planner" }));
      },
    });
    await fireEvent.press(await screen.findByTestId("lead-close"));
    // The reason is required and trimmed: a whitespace-only reason is blocked and sends nothing.
    await fireEvent.changeText(await screen.findByTestId("lead-close-reason"), "   ");
    await fireEvent.press(screen.getByTestId("lead-close-submit"));
    expect(await screen.findByText("Give a reason for closing this lead")).toBeOnTheScreen();
    expect(bodies).toEqual([]);
    await fireEvent.changeText(screen.getByTestId("lead-close-reason"), "Chose another planner");
    await fireEvent.press(screen.getByTestId("lead-close-submit"));
    expect(await screen.findByText("Lead closed")).toBeOnTheScreen();
    expect(bodies).toEqual([{ status: "closed", closedReason: "Chose another planner" }]);
  });

  it("merges a flagged duplicate into the original after a confirm", async () => {
    const survivorId = "018f0000-0000-7000-8000-0000000009a1";
    const bodies: unknown[] = [];
    await renderCard(leadFixture({ duplicateOfLeadId: survivorId }), {
      [`${LEAD_PATH}/merge`]: (init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return ok(leadFixture({ status: "closed" }));
      },
    });
    await fireEvent.press(await screen.findByTestId("lead-merge"));
    await fireEvent.press(await screen.findByTestId("lead-merge-confirm-confirm"));
    expect(await screen.findByText("Lead merged into the original")).toBeOnTheScreen();
    expect(bodies).toEqual([{ survivorLeadId: survivorId }]);
  });

  it("offers no Merge action on a lead that is not a flagged duplicate", async () => {
    await renderCard(leadFixture());
    expect(await screen.findByTestId("lead-manage")).toBeOnTheScreen();
    expect(screen.queryByTestId("lead-merge")).toBeNull();
  });

  it("hides entirely on a terminal lead", async () => {
    await renderCard(leadFixture({ status: "closed" }));
    expect(screen.queryByTestId("lead-manage")).toBeNull();
  });
});
