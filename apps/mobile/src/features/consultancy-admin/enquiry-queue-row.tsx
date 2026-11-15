import { formatDayRange, type HotelEnquiryStaffView } from "@ampm/core";
import { ListItem, Stack, StatusChip } from "@ampm/ui";

import type { Badge } from "../consultancy/consultancy.format";
import {
  enquiryClientTitle,
  enquiryQueueLine,
  holderBadge,
  holderSpoken,
  proposalTag,
  staffEnquiryBadge,
} from "./consultancy-admin.format";

/**
 * One enquiry in the queue on a phone and a tablet: who sent it (the client account), the hotel with
 * the guests and the age, the stay as data, and at the right the status chip with the newest
 * proposal's tag and who holds it ("Hema H.", or the gold "Unassigned" while it is the team's to pick
 * up). A desktop's queue uses `EnquiryQueueCard` beside the open enquiry.
 */
export function EnquiryQueueRow({
  enquiry,
  onPress,
}: {
  readonly enquiry: HotelEnquiryStaffView;
  readonly onPress: () => void;
}) {
  const badge = staffEnquiryBadge[enquiry.status];
  const title = enquiryClientTitle(enquiry);
  const subtitle = [enquiry.hotelName, enquiryQueueLine(enquiry)].filter(Boolean).join(" · ");
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  const proposal = proposalTag(enquiry.latestProposal);
  const spoken = [title, badge.label, proposal?.label, holderSpoken(enquiry), subtitle, stay];
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      meta={formatDayRange(enquiry.dateFrom, enquiry.dateTo, { style: "data" })}
      trailing={<RowChips chips={[badge, proposal, holderBadge(enquiry)]} />}
      onPress={onPress}
      accessibilityLabel={spoken.filter(Boolean).join(", ")}
    />
  );
}

/** The row's chips, stacked at its right edge: the status, then the proposal tag and the holder. */
function RowChips({ chips }: { readonly chips: ReadonlyArray<Badge | null> }) {
  return (
    <Stack gap={1} align="end">
      {chips.map((chip) =>
        chip ? (
          <StatusChip
            key={chip.label}
            label={chip.label}
            tone={chip.tone}
            size="sm"
            className="self-end"
          />
        ) : null,
      )}
    </Stack>
  );
}
