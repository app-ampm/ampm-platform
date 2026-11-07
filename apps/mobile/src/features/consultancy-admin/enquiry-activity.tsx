import { useState } from "react";

import type { HotelEnquiryStaffDetailView } from "@ampm/core";
import { Card, InternalPanel, SegmentedControl, Stack, Text } from "@ampm/ui";

import { eventLabel, formatDate } from "../consultancy/consultancy.format";

type EnquiryEvent = HotelEnquiryStaffDetailView["events"][number];

type ActivityFilter = "all" | "client" | "internal";

const FILTERS: ReadonlyArray<{ readonly value: ActivityFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "client", label: "Client-visible" },
  { value: "internal", label: "Internal" },
];

function isActivityFilter(value: string): value is ActivityFilter {
  return FILTERS.some((filter) => filter.value === value);
}

function matches(event: EnquiryEvent, filter: ActivityFilter): boolean {
  if (filter === "all") return true;
  return event.internalOnly === (filter === "internal");
}

/**
 * The full event timeline, newest first, including the internal-only events a client never sees, with
 * T6's All · Client-visible · Internal switch. Internal events sit in InternalPanels, so the two kinds
 * stay apart at a glance as well as by the switch.
 */
export function EnquiryActivity({ events }: { readonly events: readonly EnquiryEvent[] }) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  if (events.length === 0) return null;
  const shown = events.filter((event) => matches(event, filter));
  return (
    <Stack gap={3}>
      <Text variant="heading">Activity</Text>
      <SegmentedControl
        accessibilityLabel="Show activity"
        size="sm"
        options={FILTERS}
        value={filter}
        onChange={(value) => setFilter(isActivityFilter(value) ? value : "all")}
      />
      <Card className="md:p-7" testID="enquiry-activity">
        <Stack gap={2}>
          {shown.length === 0 ? (
            <Text variant="bodySmall" tone="muted">
              {filter === "internal"
                ? "No internal activity yet."
                : "No client-visible activity yet."}
            </Text>
          ) : (
            shown.map((event) => <EventRow key={event.id} event={event} />)
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

/** One event: a flat row when the client sees it too, an internal panel when only staff do. */
function EventRow({ event }: { readonly event: EnquiryEvent }) {
  const when = formatDate(event.occurredAt).toUpperCase();
  const summary = event.summary ? (
    <Text variant="bodySmall" tone="body">
      {event.summary}
    </Text>
  ) : null;
  if (event.internalOnly)
    return (
      <InternalPanel label={`Internal · ${eventLabel(event.eventType)}`} className="rounded">
        {summary}
        <Text variant="data" tone="muted">
          {when}
        </Text>
      </InternalPanel>
    );
  return (
    <Card tone="flat" padding="sm">
      <Stack gap={1}>
        <Text variant="label">{eventLabel(event.eventType)}</Text>
        {summary}
        <Text variant="data" tone="muted">
          {when}
        </Text>
      </Stack>
    </Card>
  );
}
