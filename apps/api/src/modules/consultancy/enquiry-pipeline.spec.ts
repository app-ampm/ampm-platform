import { describe, expect, it, vi } from "vitest";

import type { EnquiryInsightsRepository } from "./enquiry-insights.repository.js";
import { pipelineView } from "./enquiry-pipeline.js";

const READER = "0192f3a0-7d3e-7b1a-9c2f-0000000000f1";

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
    // Nobody holds six open enquiries; the reader holds two.
    countOpenHeldBy: vi.fn(
      async (_scope: unknown, holder: string | null, _open: readonly string[]) =>
        holder === null ? 6 : 2,
    ),
  };
}

const view = (repo: ReturnType<typeof insights>, readerId: string | null = READER) =>
  pipelineView(repo as unknown as EnquiryInsightsRepository, {}, readerId);

describe("pipelineView", () => {
  it("folds the per-status counts into the six stages, a stage with none at zero", async () => {
    expect(await view(insights())).toEqual({
      stages: { new: 2, with_hotel: 4, proposal: 0, client_decision: 4, confirmed: 0, closed: 5 },
      unassignedOpen: 6,
      mineOpen: 2,
    });
  });

  it("counts only open enquiries as unassigned work, and as the reader's", async () => {
    const repo = insights();
    await view(repo);
    expect(repo.countOpenHeldBy.mock.calls.map((call) => call[1])).toEqual([null, READER]);
    for (const call of repo.countOpenHeldBy.mock.calls) {
      const open = call[2];
      expect(open).toEqual(
        expect.arrayContaining(["submitted", "proposal_received", "client_decision"]),
      );
      expect(open).not.toContain("confirmed");
      expect(open).not.toContain("closed");
    }
  });

  it("holds nothing for a reader with no user id, without asking", async () => {
    const repo = insights();
    expect((await view(repo, null)).mineOpen).toBe(0);
    expect(repo.countOpenHeldBy).toHaveBeenCalledTimes(1);
  });
});
