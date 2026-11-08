import type { LeadFunnelView, LeadStatus } from "@ampm/core";

import { PIPELINE_STATUSES } from "./sales.format";

/*
 * Pure logic for the lead funnel report (TW-83): the date-window presets and the bar rows. No React,
 * no I/O — tested in lead-funnel.test.ts.
 */

export type FunnelWindow = "all" | "last_30" | "last_90" | "this_year";

export const FUNNEL_WINDOWS: readonly FunnelWindow[] = ["all", "last_30", "last_90", "this_year"];

const WINDOW_LABEL: Record<FunnelWindow, string> = {
  all: "All time",
  last_30: "30 days",
  last_90: "90 days",
  this_year: "This year",
};

export function funnelWindowLabel(window: FunnelWindow): string {
  return WINDOW_LABEL[window];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The `{ from, to }` date range a window covers, from `now` (ms); "all" has no bounds (whole history). */
export function funnelRange(window: FunnelWindow, now: number): { from?: string; to?: string } {
  if (window === "all") return {};
  const to = isoDate(now);
  if (window === "this_year") {
    return { from: `${new Date(now).getUTCFullYear()}-01-01`, to };
  }
  return { from: isoDate(now - (window === "last_30" ? 30 : 90) * DAY_MS), to };
}

export interface StatusBar {
  readonly status: LeadStatus;
  readonly count: number;
  readonly fraction: number;
}

/** The by-status rows in funnel (pipeline) order, each a share of the busiest stage for its bar width. */
export function statusBars(view: LeadFunnelView): readonly StatusBar[] {
  const max = Math.max(1, ...view.byStatus.map((s) => s.count));
  return [...view.byStatus]
    .sort((a, b) => PIPELINE_STATUSES.indexOf(a.status) - PIPELINE_STATUSES.indexOf(b.status))
    .map((s) => ({ status: s.status, count: s.count, fraction: s.count / max }));
}

export interface SourceBar {
  readonly sourceKey: string;
  readonly name: string;
  readonly count: number;
  readonly fraction: number;
}

/** The by-source rows, busiest first, each a share of the top source for its bar width. */
export function sourceBars(view: LeadFunnelView): readonly SourceBar[] {
  const max = Math.max(1, ...view.bySource.map((s) => s.count));
  return [...view.bySource]
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      sourceKey: s.sourceKey,
      name: s.name,
      count: s.count,
      fraction: s.count / max,
    }));
}
