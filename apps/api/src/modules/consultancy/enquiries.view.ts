import type {
  HotelEnquiryClientDetailView,
  HotelEnquiryClientView,
  HotelEnquiryEventClientView,
  HotelEnquiryEventView,
  HotelEnquiryStaffDetailView,
  HotelEnquiryStaffView,
} from "@ampm/core";

import type { EnquiryEventRow } from "./enquiry-events.repository.js";
import type { EnquiryRow } from "./enquiries.repository.js";

/**
 * One serialiser per audience (security.md). The client views carry CLIENT fields only — `notes_internal`
 * (RESTRICTED-NOTES), the assignee, the service agreement, the requesting user and internal-only events
 * are ABSENT, never a hide-flag. The return type is the `@ampm/core` view, so TypeScript rejects any
 * stray field. The client detail drops internal-only events entirely (row-level absence).
 */

function iso(date: Date): string {
  return date.toISOString();
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toEnquiryClientView(row: EnquiryRow): HotelEnquiryClientView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    projectId: row.projectId,
    status: row.status,
    dateFrom: dateOnly(row.dateFrom),
    dateTo: dateOnly(row.dateTo),
    datesFlexible: row.datesFlexible,
    guestEstimate: row.guestEstimate,
    roomsRequired: row.roomsRequired,
    functionsSummary: row.functionsSummary,
    contactPreference: row.contactPreference,
    notesClient: row.notesClient,
    outcome: row.outcome,
    submittedAt: row.submittedAt ? iso(row.submittedAt) : null,
    closedAt: row.closedAt ? iso(row.closedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

/**
 * `withInternalNotes` is the principal's `consultancy.enquiry_notes.read` grant (SA/SM/HT/PM). When it
 * is false (FA), `notes_internal` is left off the object entirely — absence, not a nulled field.
 */
export function toEnquiryStaffView(
  row: EnquiryRow,
  withInternalNotes: boolean,
): HotelEnquiryStaffView {
  const base: HotelEnquiryStaffView = {
    ...toEnquiryClientView(row),
    accountId: row.accountId,
    requestedByUserId: row.requestedByUserId,
    assignedUserId: row.assignedUserId,
    serviceAgreementId: row.serviceAgreementId,
  };
  return withInternalNotes ? { ...base, notesInternal: row.notesInternal } : base;
}

export function toEnquiryEventClientView(event: EnquiryEventRow): HotelEnquiryEventClientView {
  return {
    id: event.id,
    eventType: event.eventType,
    occurredAt: iso(event.occurredAt),
    summary: event.summary,
  };
}

export function toEnquiryEventView(event: EnquiryEventRow): HotelEnquiryEventView {
  return {
    id: event.id,
    enquiryId: event.enquiryId,
    eventType: event.eventType,
    occurredAt: iso(event.occurredAt),
    userId: event.userId,
    summary: event.summary,
    internalOnly: event.internalOnly,
    documentId: event.documentId,
    createdAt: iso(event.createdAt),
  };
}

export function toEnquiryClientDetailView(
  row: EnquiryRow,
  events: readonly EnquiryEventRow[],
): HotelEnquiryClientDetailView {
  return {
    ...toEnquiryClientView(row),
    events: events.filter((event) => !event.internalOnly).map(toEnquiryEventClientView),
  };
}

export function toEnquiryStaffDetailView(
  row: EnquiryRow,
  events: readonly EnquiryEventRow[],
  withInternalNotes: boolean,
): HotelEnquiryStaffDetailView {
  // A staff reader without the internal-notes grant (FA) also never sees internal-only events.
  const visible = withInternalNotes ? events : events.filter((event) => !event.internalOnly);
  return {
    ...toEnquiryStaffView(row, withInternalNotes),
    events: visible.map(toEnquiryEventView),
  };
}
