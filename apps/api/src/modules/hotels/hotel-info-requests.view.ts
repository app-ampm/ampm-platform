import {
  hotelInfoRequestEventView,
  type HotelInfoRequestEventView,
  type HotelInfoRequestFullView,
  type HotelInfoRequestSummaryView,
} from "@ampm/core";

import type { RequestEventRow, RequestRow } from "./hotel-info-requests.repository.js";

/*
 * A hotel information request in its audience's model (D-188 §3; core hotel-info-request-views.ts): the
 * summary for every reader, the full view, with the recipient and the latest events, for a holder of
 * `hotels.info_requests.update`. The link's secret and its hash are in neither: the repository never
 * selects the hash.
 */

const isoOrNull = (value: Date | null): string | null => value?.toISOString() ?? null;

/**
 * The summary: every INTERNAL column, without the recipient or the history.
 *
 * @example
 * toRequestSummary(row, new Date()); // isExpired true once expiresAt has passed
 */
export function toRequestSummary(row: RequestRow, now: Date): HotelInfoRequestSummaryView {
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    target: row.target,
    status: row.status,
    isTest: row.isTest,
    hotelId: row.hotelId,
    hotelName: row.hotel?.name ?? null,
    proposedName: row.proposedName,
    proposedDestinationId: row.proposedDestinationId,
    proposedWebAddress: row.proposedWebAddress,
    destinationName: row.hotel?.destination.name ?? row.proposedDestination?.name ?? null,
    officialWebsite: row.officialWebsite,
    switchboardPhone: row.switchboardPhone,
    switchboardSource: row.switchboardSource,
    displayLabel: row.displayLabel,
    staffNote: row.staffNote,
    expiresAt: row.expiresAt.toISOString(),
    isExpired: row.expiresAt.getTime() <= now.getTime(),
    statusOnlyUntil: isoOrNull(row.statusOnlyUntil),
    tokenGeneration: row.tokenGeneration,
    linkIssuedAt: row.linkIssuedAt.toISOString(),
    linkEmailedAt: isoOrNull(row.linkEmailedAt),
    revokedAt: isoOrNull(row.revokedAt),
    revokeReason: row.revokeReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** One event; a stored detail that is not flat JSON values is answered as null rather than passed on. */
export function toRequestEvent(row: RequestEventRow): HotelInfoRequestEventView {
  const detail = hotelInfoRequestEventView.shape.detail.safeParse(row.detail);
  return {
    id: row.id,
    eventType: row.eventType,
    actorKind: row.actorKind,
    actorUserId: row.actorUserId,
    detail: detail.success ? detail.data : null,
    occurredAt: row.occurredAt.toISOString(),
  };
}

/**
 * The full view: the summary, the recipient, the latest expiry an extension may set and the events.
 *
 * @example
 * toRequestFull(row, events, extendableUntil, new Date());
 */
export function toRequestFull(
  row: RequestRow,
  events: readonly RequestEventRow[],
  extendableUntil: Date | null,
  now: Date,
): HotelInfoRequestFullView {
  return {
    ...toRequestSummary(row, now),
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    extendableUntil: isoOrNull(extendableUntil),
    events: events.map(toRequestEvent),
  };
}
