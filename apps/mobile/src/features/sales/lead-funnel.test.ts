import type { LeadFunnelView } from "@ampm/core";

import { funnelRange, sourceBars, statusBars } from "./lead-funnel";

// 2026-11-08T12:00:00Z, so the window offsets land on clean UTC days.
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);

describe("lead-funnel", () => {
  it("computes each window's date range from now", () => {
    expect(funnelRange("all", NOW)).toEqual({});
    expect(funnelRange("last_30", NOW)).toEqual({ from: "2026-10-09", to: "2026-11-08" });
    expect(funnelRange("last_90", NOW)).toEqual({ from: "2026-08-10", to: "2026-11-08" });
    expect(funnelRange("this_year", NOW)).toEqual({ from: "2026-01-01", to: "2026-11-08" });
  });

  it("orders status bars by the funnel and scales to the busiest stage", () => {
    const view: LeadFunnelView = {
      total: 10,
      byStatus: [
        { status: "contacted", count: 2 },
        { status: "new", count: 8 },
      ],
      bySource: [],
    };
    const bars = statusBars(view);
    expect(bars.map((bar) => bar.status)).toEqual(["new", "contacted"]);
    expect(bars[0]).toMatchObject({ count: 8, fraction: 1 });
    expect(bars[1]).toMatchObject({ count: 2, fraction: 0.25 });
  });

  it("orders source bars busiest first and scales to the top source", () => {
    const view: LeadFunnelView = {
      total: 5,
      byStatus: [],
      bySource: [
        { sourceKey: "website", name: "Website", count: 2 },
        { sourceKey: "instagram", name: "Instagram", count: 3 },
      ],
    };
    const bars = sourceBars(view);
    expect(bars.map((bar) => bar.name)).toEqual(["Instagram", "Website"]);
    expect(bars[0].fraction).toBe(1);
  });
});
