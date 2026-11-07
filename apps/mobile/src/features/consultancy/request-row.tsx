import { useHotel } from "@ampm/api-client";
import type { HotelEnquiryClientView } from "@ampm/core";
import { ListItem, StatusChip } from "@ampm/ui";

import { enquiryChip, formatStay, guestsLabel } from "./consultancy.format";

/**
 * One enquiry in the list (D8): the hotel's name, the stay and the party, and its status as a chip.
 * The enquiry carries only the hotel's id, so the row reads the hotel's name through the same cached
 * query the detail screen uses, and says "Hotel request" until it arrives (or if it cannot).
 */
export function RequestRow({
  enquiry,
  onOpen,
}: {
  readonly enquiry: HotelEnquiryClientView;
  readonly onOpen: () => void;
}) {
  const hotel = useHotel(enquiry.hotelId);
  const chip = enquiryChip(enquiry);
  const title = hotel.data?.name ?? "Hotel request";
  const stay = formatStay(enquiry.dateFrom, enquiry.dateTo);
  const party = guestsLabel(enquiry.guestEstimate);
  return (
    <ListItem
      title={title}
      subtitle={stay}
      meta={party}
      trailing={<StatusChip label={chip.label} tone={chip.tone} size="sm" />}
      onPress={onOpen}
      accessibilityLabel={`${title}, ${chip.label}, ${stay}, ${party}`}
      testID={`request-${enquiry.id}`}
    />
  );
}
