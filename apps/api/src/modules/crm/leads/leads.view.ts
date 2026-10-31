import type { LeadActivityView, LeadView } from "@ampm/core";

import type { LeadActivityRow } from "./lead-activities.repository.js";
import type { LeadRow } from "./leads.repository.js";

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Map a repository row to the staff lead view (every field INTERNAL; dates to ISO, date-only to YYYY-MM-DD). */
export function toLeadView(row: LeadRow, nextFollowUpAt: Date | null): LeadView {
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    email: row.email,
    phone: row.phone,
    contactPreference: row.contactPreference,
    tentativeDateFrom: dateOnly(row.tentativeDateFrom),
    tentativeDateTo: dateOnly(row.tentativeDateTo),
    destinationId: row.destinationId,
    destinationText: row.destinationText,
    guestEstimate: row.guestEstimate,
    requirements: row.requirements,
    source: row.source,
    consentMarketing: row.consentMarketing,
    consentAt: iso(row.consentAt),
    consentNoticeVersion: row.consentNoticeVersion,
    requestedDemo: row.requestedDemo,
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
    convertedAccountId: row.convertedAccountId,
    convertedAt: iso(row.convertedAt),
    closedReason: row.closedReason,
    duplicateOfLeadId: row.duplicateOfLeadId,
    nextFollowUpAt: iso(nextFollowUpAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toActivityView(row: LeadActivityRow): LeadActivityView {
  return {
    id: row.id,
    leadId: row.leadId,
    activityType: row.activityType,
    occurredAt: row.occurredAt.toISOString(),
    userId: row.userId,
    summary: row.summary,
    questionnaireJson: row.questionnaireJson ?? null,
    nextFollowUpAt: iso(row.nextFollowUpAt),
    createdAt: row.createdAt.toISOString(),
  };
}
