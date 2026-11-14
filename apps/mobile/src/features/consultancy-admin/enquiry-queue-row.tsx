import { formatDayRange, type HotelEnquiryStaffView } from "@ampm/core";
import { ListItem, Stack, StatusChip } from "@ampm/ui";

import { UNASSIGNED_BADGE, enquiryQueueLine, staffEnquiryBadge } from "./consultancy-admin.format";

/**
 * One enquiry in the queue on a phone and a tablet: what is being planned, the guests and the age, the
 * stay as data, the status chip and, when nobody holds it yet, the gold "Unassigned" (the team's to
 * pick up). A desktop's queue uses `EnquiryQueueCard` beside the open enquiry.
 */
export function EnquiryQueueRow({
  enquiry,
  onPress,
}: {
  readonly enquiry: HotelEnquiryStaffView;
  readonly onPress: () => void;
}) {
  const badge = staffEnquiryBadge[enquiry.status];
  const unassigned = enquiry.assignedUserId === null;
  const title = enquiry.functionsSummary ?? "Hotel enquiry";
  const subtitle = enquiryQueueLine(enquiry);
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  const spoken = [title, badge.label, unassigned ? UNASSIGNED_BADGE.label : null, subtitle, stay];
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      meta={formatDayRange(enquiry.dateFrom, enquiry.dateTo, { style: "data" })}
      trailing={
        <Stack gap={1} align="end">
          <StatusChip label={badge.label} tone={badge.tone} size="sm" className="self-end" />
          {unassigned ? (
            <StatusChip
              label={UNASSIGNED_BADGE.label}
              tone={UNASSIGNED_BADGE.tone}
              size="sm"
              className="self-end"
            />
          ) : null}
        </Stack>
      }
      onPress={onPress}
      accessibilityLabel={spoken.filter(Boolean).join(", ")}
    />
  );
}
