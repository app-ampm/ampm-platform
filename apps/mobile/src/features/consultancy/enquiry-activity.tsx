import { formatDay, type HotelEnquiryEventClientView } from "@ampm/core";
import { Card, Row, Stack, Text } from "@ampm/ui";

import { eventLabel } from "./consultancy.format";

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
 * The enquiry's client-visible timeline (D8's thread): one glass panel of flat rows, newest first as
 * the API sends them. Internal-only events and their authors never reach the client view.
 */
export function EnquiryActivity({
  events,
}: {
  readonly events: readonly HotelEnquiryEventClientView[];
}) {
  if (events.length === 0) return null;
  return (
    <Stack gap={3}>
      <Text variant="heading">Activity</Text>
      <Card padding="sm">
        <Stack gap={2}>
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
