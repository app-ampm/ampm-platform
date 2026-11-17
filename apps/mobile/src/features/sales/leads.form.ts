import {
  leadUpdateRequest,
  type LeadActivityCreateRequest,
  type LeadActivityType,
  type LeadUpdateRequest,
} from "@ampm/core";

/*
 * Pure form logic for the Sales workspace's lead actions (TW-11/TW-12): the add-activity draft and the
 * follow-up quick-pick. No React, no I/O — tested in leads.form.test.ts.
 */

/**
 * The activity types a salesperson logs by hand. `questionnaire` is excluded (it needs structured answers,
 * not a free-text summary — the schema refuses it otherwise) and so is `call_request` (a client-side signal).
 */
export const LOGGABLE_ACTIVITY_TYPES: readonly LeadActivityType[] = [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "consultation",
  "demo",
  "note",
];

export type FollowUpChoice = "none" | "tomorrow" | "in_three_days" | "next_week";

export const FOLLOW_UP_CHOICES: readonly FollowUpChoice[] = [
  "none",
  "tomorrow",
  "in_three_days",
  "next_week",
];

const FOLLOW_UP_LABEL: Record<FollowUpChoice, string> = {
  none: "No follow-up",
  tomorrow: "Tomorrow",
  in_three_days: "In 3 days",
  next_week: "Next week",
};

export function followUpLabel(choice: FollowUpChoice): string {
  return FOLLOW_UP_LABEL[choice];
}

export interface ActivityDraft {
  readonly activityType: LeadActivityType;
  readonly summary: string;
  readonly followUp: FollowUpChoice;
}

export function emptyActivityDraft(): ActivityDraft {
  return { activityType: "call", summary: "", followUp: "none" };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_DAYS: Record<Exclude<FollowUpChoice, "none">, number> = {
  tomorrow: 1,
  in_three_days: 3,
  next_week: 7,
};

/** The follow-up datetime a choice schedules, from `now` (ms); `null` when no follow-up is set. */
export function followUpAt(choice: FollowUpChoice, now: number): string | null {
  if (choice === "none") return null;
  return new Date(now + FOLLOW_UP_DAYS[choice] * DAY_MS).toISOString();
}

/** Build the add-activity request: a blank summary is omitted (never sent empty), the follow-up resolved. */
export function buildActivityBody(draft: ActivityDraft, now: number): LeadActivityCreateRequest {
  const summary = draft.summary.trim();
  const nextFollowUpAt = followUpAt(draft.followUp, now);
  return {
    activityType: draft.activityType,
    ...(summary ? { summary } : {}),
    ...(nextFollowUpAt ? { nextFollowUpAt } : {}),
  };
}

export const LEAD_EMAIL_ERROR = "Enter a valid email address";

export type LeadEmailBuild =
  | { readonly ok: true; readonly body: LeadUpdateRequest }
  | { readonly ok: false; readonly error: string };

/**
 * The lead edit that adds an email so the portal invite has somewhere to go (a phone-only enquiry),
 * checked by the API's own `leadUpdateRequest`, which also trims and lowercases it; a blank entry fails
 * the same check, so it never reaches the API as an empty email.
 */
export function buildLeadEmail(input: string): LeadEmailBuild {
  const parsed = leadUpdateRequest.safeParse({ email: input });
  return parsed.success ? { ok: true, body: parsed.data } : { ok: false, error: LEAD_EMAIL_ERROR };
}
