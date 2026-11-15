import { describe, expect, it, vi } from "vitest";

import type { EnquiryInsightsRepository } from "./enquiry-insights.repository.js";
import { pipelineView } from "./enquiry-pipeline.js";

function insights() {
  return {
    countByStatus: vi.fn(
      async () =>
        new Map([
          ["submitted", 2],
          ["awaiting_hotel", 1],
          ["negotiating", 3],
          ["client_decision", 4],
          ["closed", 5],
        ]),
    ),
    countUnassigned: vi.fn(async (_scope: unknown, _open: readonly string[]) => 6),
  };
}

describe("pipelineView", () => {
  it("folds the per-status counts into the six stages, a stage with none at zero", async () => {
    const repo = insights();
    const view = await pipelineView(repo as unknown as EnquiryInsightsRepository, {});
    expect(view).toEqual({
      stages: { new: 2, with_hotel: 4, proposal: 0, client_decision: 4, confirmed: 0, closed: 5 },
      unassignedOpen: 6,
    });
  });

  it("counts only open enquiries as unassigned work", async () => {
    const repo = insights();
    await pipelineView(repo as unknown as EnquiryInsightsRepository, {});
    const open = repo.countUnassigned.mock.calls.at(0)?.at(1);
    expect(open).toEqual(
      expect.arrayContaining(["submitted", "proposal_received", "client_decision"]),
    );
    expect(open).not.toContain("confirmed");
    expect(open).not.toContain("closed");
  });
});
