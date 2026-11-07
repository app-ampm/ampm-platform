import type { HotelEnquiryStaffDetailView } from "@ampm/core";
import { Card, InternalPanel, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { ASSIGNED_BADGE, UNASSIGNED_BADGE } from "./consultancy-admin.format";

/**
 * Who holds the enquiry, the hotel it is for, and its two notes kept apart: the client's own words in
 * a flat row, and the internal note inside an InternalPanel. `notesInternal` is absent for a staff
 * reader without the notes grant (security.md), and then no panel is drawn.
 */
export function EnquiryDetails({ enquiry }: { readonly enquiry: HotelEnquiryStaffDetailView }) {
  const holder = enquiry.assignedUserId === null ? UNASSIGNED_BADGE : ASSIGNED_BADGE;
  return (
    <Card className="md:p-7">
      <Stack gap={3}>
        <Row gap={2} wrap align="center">
          <StatusChip label={holder.label} tone={holder.tone} size="sm" />
          <Text variant="data" tone="muted">{`Hotel ref ${enquiry.hotelId.slice(0, 8)}`}</Text>
        </Row>
        {enquiry.notesClient ? <ClientNote note={enquiry.notesClient} /> : null}
        {enquiry.notesInternal ? (
          <InternalPanel className="rounded" testID="enquiry-internal-note">
            <Text variant="bodySmall" tone="body">
              {enquiry.notesInternal}
            </Text>
          </InternalPanel>
        ) : null}
      </Stack>
    </Card>
  );
}

/** The client's note: client-visible, so a plain flat row, never the internal panel. */
function ClientNote({ note }: { readonly note: string }) {
  return (
    <Card tone="flat" padding="sm" testID="enquiry-client-note">
      <Stack gap={1}>
        <Text variant="eyebrow">Client note</Text>
        <Text variant="bodySmall" tone="body">
          {note}
        </Text>
      </Stack>
    </Card>
  );
}
