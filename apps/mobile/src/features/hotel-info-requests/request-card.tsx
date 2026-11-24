import type { ReactNode } from "react";

import { formatDay, type HotelInfoRequestDetail, type HotelInfoRequestEventView } from "@ampm/core";
import { Row, Stack, StatusChip, Text } from "@ampm/ui";

import {
  eventLine,
  expiryText,
  infoRequestKindLabel,
  infoRequestStatusLabel,
  infoRequestStatusTone,
  isLinkExpired,
} from "./info-requests.format";
import { RequestActions } from "./request-actions";

/** The latest events a card lists; the full view carries up to twenty. */
const EVENTS_LISTED = 5;

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Stack gap={1}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      {typeof children === "string" ? <Text variant="bodySmall">{children}</Text> : children}
    </Stack>
  );
}

/** The reference, the status, the round and, for a test, the test chip. */
function RequestTitle({ request }: { readonly request: HotelInfoRequestDetail }) {
  return (
    <Row gap={2} align="center" wrap>
      <Text variant="data" testID="request-reference">
        {request.reference}
      </Text>
      <StatusChip
        label={infoRequestStatusLabel(request.status)}
        tone={infoRequestStatusTone(request.status)}
        size="sm"
        testID="request-status"
      />
      <StatusChip label={infoRequestKindLabel(request.kind)} tone="info" size="sm" />
      {request.isTest ? <StatusChip label="Test" tone="neutral" size="sm" /> : null}
    </Row>
  );
}

/** When the current link was issued and emailed. */
function linkText(request: HotelInfoRequestDetail): string {
  const issued = `Issued ${formatDay(request.linkIssuedAt)} (link ${request.tokenGeneration})`;
  const emailed = request.linkEmailedAt
    ? `emailed ${formatDay(request.linkEmailedAt)}`
    : "not emailed";
  return `${issued}, ${emailed}`;
}

/** The recipient as AMPM entered them: the full view's alone. */
function recipientText(request: HotelInfoRequestDetail): string | null {
  if (!("recipientEmail" in request)) return null;
  const parts = [request.recipientName, request.recipientEmail].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No recipient yet";
}

function RequestFacts({ request }: { readonly request: HotelInfoRequestDetail }) {
  const recipient = recipientText(request);
  return (
    <Stack gap={3}>
      <RequestTitle request={request} />
      {request.displayLabel ? <Fact label="Label">{request.displayLabel}</Fact> : null}
      <Fact label="Link">
        <Stack gap={1}>
          <Text
            variant="bodySmall"
            tone={isLinkExpired(request) ? "brand" : "primary"}
            testID="request-expiry"
          >
            {expiryText(request)}
          </Text>
          <Text variant="bodySmall" tone="muted">
            {linkText(request)}
          </Text>
        </Stack>
      </Fact>
      {recipient ? <Fact label="Recipient">{recipient}</Fact> : null}
      {request.staffNote ? <Fact label="Note to the hotel">{request.staffNote}</Fact> : null}
      {request.revokeReason ? <Fact label="Revoked because">{request.revokeReason}</Fact> : null}
    </Stack>
  );
}

/** The latest events, newest first. */
function RequestEvents({ events }: { readonly events: readonly HotelInfoRequestEventView[] }) {
  if (events.length === 0) return null;
  return (
    <Fact label="Latest activity">
      <Stack gap={1} testID="request-events">
        {events.slice(0, EVENTS_LISTED).map((event) => (
          <Text key={event.id} variant="bodySmall" tone="body">
            {eventLine(event)}
          </Text>
        ))}
      </Stack>
    </Fact>
  );
}

export interface RequestCardProps {
  /** The request in the reader's model: the full view carries the recipient, the events and actions. */
  readonly request: HotelInfoRequestDetail;
  /** Offer the actions (`hotels.info_requests.update`); the summary model never has any. */
  readonly canUpdate: boolean;
}

/**
 * One hotel information request (D-188 §7): reference, status, round, expiry, the link's issue and email,
 * the recipient, the note and the latest events, then the actions a holder of the update key may take.
 * A reader of the summary (SM, PM) sees the facts alone: no recipient, no events, no action.
 *
 *   <RequestCard request={detail.data} canUpdate={canUpdate} />
 */
export function RequestCard({ request, canUpdate }: RequestCardProps) {
  const full = "events" in request ? request : null;
  return (
    <Stack gap={4} testID="request-card">
      <RequestFacts request={request} />
      {full ? <RequestEvents events={full.events} /> : null}
      {full && canUpdate ? <RequestActions request={full} /> : null}
    </Stack>
  );
}
