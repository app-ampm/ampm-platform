import { formatDayRange, type HotelEnquiryStaffView } from "@ampm/core";
import { Card, cn, Row, StatusChip, Text } from "@ampm/ui";

import type { Badge } from "../consultancy/consultancy.format";
import { ViewingMark } from "../consultancy/viewing-mark";
import {
  enquiryClientTitle,
  enquiryQueueLine,
  proposalTag,
  staffEnquiryBadge,
  UNASSIGNED_BADGE,
} from "./consultancy-admin.format";

export interface EnquiryQueueCardProps {
  readonly enquiry: HotelEnquiryStaffView;
  /** The enquiry open beside the queue. */
  readonly selected: boolean;
  readonly onOpen: () => void;
}

/** Screen readers hear the open card as the current one (selected natively, aria-current on the web). */
const current = (selected: boolean) =>
  selected ? { "aria-current": "true" as const, accessibilityState: { selected: true } } : {};

/**
 * One enquiry in T6's desktop queue, a flat card on the queue's glass. It leads with who sent it — the
 * client account — and its status; under that the hotel and the stay; then the party and the enquiry's
 * age, with the newest proposal's version and standing, "Viewing" on the open card and "Unassigned"
 * while nobody holds it. The open card also takes a peacock stroke over a peacock tint, but the word
 * marks it, never the colour alone.
 */
export function EnquiryQueueCard({ enquiry, selected, onOpen }: EnquiryQueueCardProps) {
  const badge = staffEnquiryBadge[enquiry.status];
  const title = enquiryClientTitle(enquiry);
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  const where = [enquiry.hotelName, stay].filter(Boolean).join(" · ");
  const line = enquiryQueueLine(enquiry);
  const proposal = proposalTag(enquiry.latestProposal);
  const holder = enquiry.assignedUserId === null ? UNASSIGNED_BADGE : null;
  const spoken = [title, badge.label, where, line, proposal?.label, holder?.label];
  return (
    <Card
      tone="flat"
      padding="none"
      onPress={onOpen}
      accessibilityLabel={spoken.filter(Boolean).join(", ")}
      {...current(selected)}
      className={cn(
        "gap-1.5 rounded-lg bg-transparent px-4 py-3.5",
        selected && "border-highlight/70 bg-highlight/10",
      )}
      testID={`enquiry-card-${enquiry.id}`}
    >
      <Row gap={3} justify="between" align="center">
        <Text weight="semibold" numberOfLines={1} className="flex-1">
          {title}
        </Text>
        <StatusChip label={badge.label} tone={badge.tone} size="sm" />
      </Row>
      <Text variant="bodySmall" tone="body" numberOfLines={1}>
        {where}
      </Text>
      <Text variant="data" tone="muted" numberOfLines={1} className="text-xs">
        {line}
      </Text>
      <CardTags proposal={proposal} holder={holder} selected={selected} />
    </Card>
  );
}

/** The card's last row, drawn only when it has something: the proposal tag, the holder, "Viewing". */
function CardTags({
  proposal,
  holder,
  selected,
}: {
  readonly proposal: Badge | null;
  readonly holder: Badge | null;
  readonly selected: boolean;
}) {
  if (!proposal && !holder && !selected) return null;
  return (
    <Row gap={2} align="center" wrap>
      {proposal ? <StatusChip label={proposal.label} tone={proposal.tone} size="sm" /> : null}
      {holder ? <StatusChip label={holder.label} tone={holder.tone} size="sm" /> : null}
      <ViewingMark selected={selected} />
    </Row>
  );
}
