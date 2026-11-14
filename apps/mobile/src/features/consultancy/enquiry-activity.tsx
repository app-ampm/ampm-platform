import { formatDay, type HotelEnquiryEventClientView } from "@ampm/core";
import { Card, Row, Stack, Text } from "@ampm/ui";

import { eventLabel } from "./consultancy.format";
import { useInDetailPanel } from "./enquiry-surface";

function ActivityRow({ event }: { readonly event: HotelEnquiryEventClientView }) {
  return (
    <Card tone="flat" padding="sm">
      <Stack gap={1}>
        <Row gap={3} justify="between" align="start">
          <Text variant="label" className="flex-1">
            {eventLabel(event.eventType)}
          </Text>
          <Text variant="data" tone="muted">
            {formatDay(event.occurredAt, { style: "data" })}
          </Text>
        </Row>
        {event.summary ? <Text>{event.summary}</Text> : null}
      </Stack>
    </Card>
  );
}

/**
 * The enquiry's client-visible timeline (D8's thread): flat rows, newest first as the API sends them,
 * on a glass panel of their own on a phone and straight on the desktop detail panel. Internal-only
 * events and their authors never reach the client view.
 */
export function EnquiryActivity({
  events,
}: {
  readonly events: readonly HotelEnquiryEventClientView[];
}) {
  const inPanel = useInDetailPanel();
  if (events.length === 0) return null;
  const rows = (
    <Stack gap={2}>
      {events.map((event) => (
        <ActivityRow key={event.id} event={event} />
      ))}
    </Stack>
  );
  return (
    <Stack gap={3}>
      <Text variant="heading">Activity</Text>
      {inPanel ? rows : <Card padding="sm">{rows}</Card>}
    </Stack>
  );
}
