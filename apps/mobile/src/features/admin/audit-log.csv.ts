import type { AuditEventView } from "@ampm/core";

import { auditActionLabel, auditActorLabel } from "./audit-log.format";
import { csvText } from "./csv";

/*
 * The filtered audit events as a CSV snapshot (a header row + one row per event). The timestamp is the
 * raw ISO `occurredAt` (precise and unambiguous for a record), the action and actor are their labels.
 * Fields are escaped by `csvText` (RFC-4180, formulas kept as text). No fetching.
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
  return csvText([HEADERS, ...rows.map(csvRow)]);
}
