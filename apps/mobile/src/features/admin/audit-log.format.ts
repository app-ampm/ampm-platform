import {
  formatDay,
  type AuditActionName,
  type AuditActorType,
  type AuditEventView,
} from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/*
 * Presentation helpers for the audit log (TW-96): the label and chip treatment per action, the actor
 * kind, and a moment in the device's time. No fetching, no rules.
 */

const ACTION_LABEL: Record<AuditActionName, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  share: "Share",
  export: "Export",
  restricted_read: "Restricted read",
};

/** Peacock for additions/approvals, gold for a deletion, gold-soft for a restricted read, outline else. */
const ACTION_TONE: Record<AuditActionName, StatusTone> = {
  create: "success",
  update: "info",
  delete: "danger",
  approve: "success",
  share: "info",
  export: "info",
  restricted_read: "warning",
};

const ACTOR_LABEL: Record<AuditActorType, string> = {
  user: "Staff",
  guest_token: "Guest",
  system: "System",
};

export function auditActionLabel(action: AuditActionName): string {
  return ACTION_LABEL[action];
}

export function auditActionTone(action: AuditActionName): StatusTone {
  return ACTION_TONE[action];
}

export function auditActorLabel(actorType: AuditActorType): string {
  return ACTOR_LABEL[actorType];
}

const twoDigits = (value: number): string => String(value).padStart(2, "0");

/** A moment in the device's time, uppercase like the mocks: "5 NOV 2026 · 18:02". */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
  return `${formatDay(iso, { style: "data" })} · ${time}`;
}

/** A screen-reader summary of one event row. */
export function auditEventSummary(event: AuditEventView): string {
  return `${auditActionLabel(event.action)} ${event.entityType} by ${auditActorLabel(
    event.actorType,
  )}, ${formatMoment(event.occurredAt)}`;
}
