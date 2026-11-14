import type { HotelEnquiryStaffDetailView } from "@ampm/core";
import { ScreenHeader, Stack, StatusChip } from "@ampm/ui";

import { enquiryFacts } from "../consultancy/consultancy.format";
import { staffEnquiryBadge, UNASSIGNED_BADGE } from "./consultancy-admin.format";
import { useEnquiryNames } from "./use-enquiry-names";

/** The page's title while the enquiry, or the hotel's name, is on its way. */
export const ENQUIRY_FALLBACK_TITLE = "Hotel enquiry";

/** Phone 28 (M4's phone titles are smaller still), 36 from 768; T6's pane title stays 36 at 1440. */
export const ENQUIRY_TITLE_SIZE = "text-3xl md:text-4xl lg:text-4xl";

export const BACK_TO_QUEUE = "Back to enquiries";

/**
 * T6's enquiry header: the client and the stay as one data line over the hotel's name, what is being
 * planned under it, and at the right the status chip with, while nobody holds the enquiry, the
 * "Unassigned" chip. The page's header on a phone (with its back button), the pane's own on a desktop.
 * The staff view carries no reference or due time, so T6's "ENQ-0418" and "26h over" are left out.
 */
export function EnquiryHeading({
  enquiry,
  onBack,
}: {
  readonly enquiry: HotelEnquiryStaffDetailView;
  readonly onBack?: (() => void) | undefined;
}) {
  const { hotelName, clientName } = useEnquiryNames(enquiry);
  const facts = [clientName, enquiryFacts(enquiry)].filter(Boolean).join(" · ");
  const planned = enquiry.functionsSummary ?? undefined;
  return (
    <ScreenHeader
      onBack={onBack}
      backLabel={BACK_TO_QUEUE}
      eyebrow={facts.toUpperCase()}
      // Until the hotel's name arrives (or if it cannot), what is being planned names the enquiry.
      title={hotelName ?? planned ?? ENQUIRY_FALLBACK_TITLE}
      subtitle={hotelName ? planned : undefined}
      titleClassName={ENQUIRY_TITLE_SIZE}
      trailing={<HeadingChips enquiry={enquiry} />}
      testID="enquiry-heading"
    />
  );
}

/** The status, and the gold "Unassigned" under it while the enquiry is the team's to pick up. */
function HeadingChips({ enquiry }: { readonly enquiry: HotelEnquiryStaffDetailView }) {
  const badge = staffEnquiryBadge[enquiry.status];
  return (
    <Stack gap={1} align="end">
      <StatusChip label={badge.label} tone={badge.tone} />
      {enquiry.assignedUserId === null ? (
        <StatusChip label={UNASSIGNED_BADGE.label} tone={UNASSIGNED_BADGE.tone} size="sm" />
      ) : null}
    </Stack>
  );
}
