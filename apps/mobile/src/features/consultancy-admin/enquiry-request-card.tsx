import { formatDay, formatDayRange, type HotelEnquiryStaffDetailView } from "@ampm/core";
import { Card, Grid, Stack, Text } from "@ampm/ui";

import { guestsLabel } from "../consultancy/consultancy.format";
import { useSectionCard } from "./use-section-card";

type Enquiry = Pick<
  HotelEnquiryStaffDetailView,
  | "hotelName"
  | "dateFrom"
  | "dateTo"
  | "datesFlexible"
  | "guestEstimate"
  | "roomsRequired"
  | "functionsSummary"
  | "notesClient"
  | "submittedAt"
  | "createdAt"
>;

/** One fact of the request: its name over its value. */
function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack gap={1} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="eyebrow">{label}</Text>
      <Text tone="primary">{value}</Text>
    </Stack>
  );
}

/**
 * What the client asked for, laid out to read at a glance rather than as one data line: the hotel,
 * the dates (and whether they can move), the guests and rooms, when it came in, then what is being
 * planned and the client's own note in their words.
 */
export function EnquiryRequestCard({ enquiry }: { readonly enquiry: Enquiry }) {
  const card = useSectionCard();
  const dates = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  const received = enquiry.submittedAt ?? enquiry.createdAt;
  return (
    <Card tone={card.tone} className={card.className} testID="enquiry-request-card">
      <Stack gap={4}>
        <Text variant="eyebrow">What they asked for</Text>
        <Grid columns={{ base: 2, md: 2, lg: 3 }} gap={4}>
          <Fact label="Hotel" value={enquiry.hotelName ?? "Hotel"} />
          <Fact label="Dates" value={enquiry.datesFlexible ? `${dates} (flexible)` : dates} />
          <Fact label="Guests" value={guestsLabel(enquiry.guestEstimate)} />
          <Fact
            label="Rooms"
            value={enquiry.roomsRequired ? `${enquiry.roomsRequired} rooms` : "Not given"}
          />
          <Fact label="Received" value={formatDay(received)} />
        </Grid>
        {enquiry.functionsSummary ? (
          <Fact label="Planning" value={enquiry.functionsSummary} />
        ) : null}
        {enquiry.notesClient ? (
          <Card tone="flat" padding="sm" testID="enquiry-request-note">
            <Stack gap={1}>
              <Text variant="eyebrow">Client note</Text>
              <Text variant="bodySmall" tone="body">
                {enquiry.notesClient}
              </Text>
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </Card>
  );
}
