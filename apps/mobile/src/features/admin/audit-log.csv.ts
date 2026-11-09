import type { AuditEventView } from "@ampm/core";

import { auditActionLabel, auditActorLabel } from "./audit-log.format";

/*
 * The filtered audit events as a CSV snapshot (a header row + one row per event). The timestamp is the
 * raw ISO `occurredAt` (precise and unambiguous for a record), the action and actor are their labels.
 * Fields are RFC-4180 escaped. No fetching.
 */

const HEADERS = [
  "When (UTC)",
  "Action",
  "Actor",
  "Entity type",
  "Entity ID",
  "IP address",
  "Request ID",
] as const;

/** Quote a field when it holds a comma, quote or newline, doubling any inner quote. */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(event: AuditEventView): readonly string[] {
  return [
    event.occurredAt,
    auditActionLabel(event.action),
    auditActorLabel(event.actorType),
    event.entityType,
    event.entityId,
    event.ipAddress ?? "",
    event.requestId ?? "",
  ];
}

/** The events as CSV text (CRLF line endings, a header row), ready to download. */
export function auditCsv(rows: readonly AuditEventView[]): string {
  return [HEADERS, ...rows.map(csvRow)].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}
