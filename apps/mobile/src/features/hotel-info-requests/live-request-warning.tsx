import type { HotelDuplicateLiveRequest } from "@ampm/core";
import { Card, Icon, Row, Stack, Text } from "@ampm/ui";

import { infoRequestStatusLabel } from "./info-requests.format";
import { inviteHotelCopy, liveRequestsHeading } from "./invite-hotel-copy";

/** One live invite: its reference and proposed name, then its status, and its website when it has one. */
function LiveRequestRow({ request }: { readonly request: HotelDuplicateLiveRequest }) {
  const facts = [
    infoRequestStatusLabel(request.status),
    request.isTest ? inviteHotelCopy.testRequest : null,
    request.proposedWebAddress,
  ].filter(Boolean);
  return (
    <Stack gap={1} testID={`duplicate-live-request-${request.requestId}`}>
      <Text variant="body">{`${request.reference} · ${request.proposedName}`}</Text>
      <Text variant="bodySmall" tone="muted">
        {facts.join(" · ")}
      </Text>
    </Stack>
  );
}

export interface LiveRequestWarningProps {
  /** The live new-hotel requests of the same name in the destination chosen, oldest first. */
  readonly requests: readonly HotelDuplicateLiveRequest[];
}

/**
 * The warning that the hotel may be invited already (D-192): the live new-hotel requests with the name
 * typed in the destination chosen. It never blocks the invite, as two hotels may share a name; nothing
 * shows when there are none.
 *
 *   <LiveRequestWarning requests={hints.data.liveRequests} />
 */
export function LiveRequestWarning({ requests }: LiveRequestWarningProps) {
  const first = requests[0];
  if (!first) return null;
  return (
    <Card tone="flat" padding="sm" testID="duplicate-live-requests">
      <Stack gap={3}>
        <Row gap={2} align="center">
          <Icon name="alert-triangle" tone="warning" size="sm" />
          <Text variant="bodySmall" tone="brand" accessibilityLiveRegion="polite">
            {liveRequestsHeading(requests.length, first.destinationName)}
          </Text>
        </Row>
        {requests.map((request) => (
          <LiveRequestRow key={request.requestId} request={request} />
        ))}
        <Text variant="bodySmall" tone="muted">
          {inviteHotelCopy.liveRequestsNote}
        </Text>
      </Stack>
    </Card>
  );
}
