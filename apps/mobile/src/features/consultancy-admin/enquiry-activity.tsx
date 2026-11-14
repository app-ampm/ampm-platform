import { useState } from "react";

import { formatDay, type HotelEnquiryStaffDetailView } from "@ampm/core";
import { Card, InternalPanel, SegmentedControl, Stack, Text } from "@ampm/ui";

import { eventLabel } from "../consultancy/consultancy.format";
import { countNotes, EnquiryNotes, passesFilter, type ThreadFilter } from "./enquiry-notes";
import { useFrameCard } from "./use-section-card";

type EnquiryEvent = HotelEnquiryStaffDetailView["events"][number];

const FILTERS: ReadonlyArray<{ readonly value: ThreadFilter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "client", label: "Client-visible" },
  { value: "internal", label: "Internal" },
];

function isThreadFilter(value: string): value is ThreadFilter {
  return FILTERS.some((filter) => filter.value === value);
}

/**
 * The enquiry's thread, first under its header as T6 sets it: the All · Client-visible · Internal
 * switch, then the standing notes and the full event timeline, newest first, including the
 * internal-only events a client never sees. Internal items sit in InternalPanels, so the two kinds
 * stay apart at a glance as well as by the switch. On a phone the thread is one glass card; in the
 * desktop pane its rows sit straight on the panel.
 */
export function EnquiryActivity({ enquiry }: { readonly enquiry: HotelEnquiryStaffDetailView }) {
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const frame = useFrameCard();
  if (enquiry.events.length === 0 && countNotes(enquiry, "all") === 0) return null;
  const shown = enquiry.events.filter((event) => passesFilter(event.internalOnly, filter));
  const isEmpty = shown.length === 0 && countNotes(enquiry, filter) === 0;
  return (
    <Stack gap={3}>
      <Text variant="heading">Activity</Text>
      <SegmentedControl
        accessibilityLabel="Show activity"
        size="sm"
        options={FILTERS}
        value={filter}
        onChange={(value) => setFilter(isThreadFilter(value) ? value : "all")}
      />
      <Card tone={frame.tone} className={frame.className} testID="enquiry-activity">
        <Stack gap={2}>
          <EnquiryNotes notes={enquiry} filter={filter} />
          {isEmpty ? (
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
  const when = formatDay(event.occurredAt, { style: "data" });
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
