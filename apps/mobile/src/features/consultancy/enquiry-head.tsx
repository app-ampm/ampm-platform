import { useHotel } from "@ampm/api-client";
import type { HotelEnquiryClientDetailView } from "@ampm/core";
import { Row, Stack, StatusChip, Text } from "@ampm/ui";

import { enquiryChip, enquiryFacts } from "./consultancy.format";

/**
 * The head of D8's detail panel: the hotel's name in Gilda 36 over the stay as one data line, the
 * status chip at the right. A phone has these in its page header and summary card instead. The name is
 * read through the cached hotel query ("Hotel request" until it arrives, or if it cannot).
 */
export function EnquiryHead({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  const hotel = useHotel(enquiry.hotelId);
  const chip = enquiryChip(enquiry);
  return (
    <Row gap={4} justify="between" align="start">
      <Stack gap={1.5} className="min-w-0 flex-1">
        <Text variant="title">{hotel.data?.name ?? "Hotel request"}</Text>
        <Text variant="data" tone="muted" className="uppercase">
          {enquiryFacts(enquiry)}
        </Text>
      </Stack>
      <StatusChip label={chip.label} tone={chip.tone} />
    </Row>
  );
}
