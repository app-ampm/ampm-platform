import {
  formatDay,
  formatDayRange,
  leadStatus,
  type LeadActivityType,
  type LeadStatus,
  type LeadView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/**
 * The pipeline's stages in the order of the lead status machine (`leadStatus` in @ampm/core, which the
 * API's transitions follow): the board's columns, left to right.
 */
export const PIPELINE_STATUSES: readonly LeadStatus[] = leadStatus.options;

/** A converted or closed lead has left the pipeline (the status machine's terminal states). */
const TERMINAL_STATUSES: readonly LeadStatus[] = ["converted", "closed"];

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  introduction_shared: "Introduction shared",
  demo_offered: "Demo offered",
  demo_accessed: "Demo accessed",
  follow_up: "Follow-up",
  converted: "Converted",
  closed: "Closed",
};

/**
 * The chip treatment per stage (docs/design/peacock-night.md §8): gold solid where Sales must act
 * (a first contact, a due follow-up), gold soft while the lead has the next move, peacock once won,
 * pearl for a closed lead and an outline for the steps in between.
 */
const STATUS_TONE: Record<LeadStatus, StatusTone> = {
  new: "danger",
  contacted: "info",
  introduction_shared: "warning",
  demo_offered: "warning",
  demo_accessed: "info",
  follow_up: "danger",
  converted: "success",
  closed: "neutral",
};

const ACTIVITY_LABEL: Record<LeadActivityType, string> = {
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  consultation: "Consultation",
  demo: "Demo",
  questionnaire: "Questionnaire",
  call_request: "Call request",
  note: "Note",
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** Past eight weeks an age in weeks stops reading well; the date says it better. */
const AGE_AS_DATE_AFTER_MS = 8 * WEEK_MS;

export function statusLabel(status: LeadStatus): string {
  return STATUS_LABEL[status];
}

export function statusTone(status: LeadStatus): StatusTone {
  return STATUS_TONE[status];
}

export function isOpenLead(status: LeadStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export function activityLabel(type: LeadActivityType): string {
  return ACTIVITY_LABEL[type];
}

/** What the list says about a lead after its name: its stage and the flags Sales acts on. */
export function leadSummary(lead: LeadView): string {
  return [
    statusLabel(lead.status),
    lead.requestedDemo ? "demo requested" : null,
    lead.duplicateOfLeadId ? "possible duplicate" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * A lead's tentative dates as data, uppercase like the mocks: "12–14 FEB 2027", "28 FEB – 2 MAR 2027",
 * "30 DEC 2027 – 2 JAN 2028", or the one date given. Null when the lead has no dates.
 */
export function formatStay(from: string | null, to: string | null): string | null {
  if (from && to) return formatDayRange(from, to, { style: "data" });
  const single = from ?? to;
  return single ? formatDay(single, { style: "data" }) : null;
}

const twoDigits = (value: number): string => String(value).padStart(2, "0");

/** A moment on the timeline in the device's time: "5 NOV 2026 · 18:02". */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
  return `${formatDay(iso, { style: "data" })} · ${time}`;
}

/**
 * How long ago a lead arrived, as the board cards show it: "45m", "2h", "3d", "5w", then the date
 * itself once it is more than eight weeks old.
 */
export function formatAge(iso: string, now: number): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";
  const elapsed = Math.max(0, now - created);
  if (elapsed < HOUR_MS) return `${Math.max(1, Math.floor(elapsed / MINUTE_MS))}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  if (elapsed < WEEK_MS) return `${Math.floor(elapsed / DAY_MS)}d`;
  if (elapsed < AGE_AS_DATE_AFTER_MS) return `${Math.floor(elapsed / WEEK_MS)}w`;
  return formatDay(iso, { style: "data" });
}

/** Where and when, as one data line: "Udaipur or Goa · 12–14 FEB 2027 · 250 guests". */
export function leadPlan(lead: LeadView): string | null {
  const parts = [
    lead.destinationText,
    formatStay(lead.tentativeDateFrom, lead.tentativeDateTo),
    lead.guestEstimate === null ? null : `${lead.guestEstimate} guests`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}
