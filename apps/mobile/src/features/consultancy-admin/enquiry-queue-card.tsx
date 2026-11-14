import { formatDayRange, type HotelEnquiryStaffView } from "@ampm/core";
import { Card, cn, Row, StatusChip, Text } from "@ampm/ui";

import { ViewingMark } from "../consultancy/viewing-mark";
import { enquiryQueueLine, staffEnquiryBadge, UNASSIGNED_BADGE } from "./consultancy-admin.format";
import { ENQUIRY_FALLBACK_TITLE } from "./enquiry-heading";

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
 * One enquiry in T6's desktop queue, a flat card on the queue's glass: the stay as data with, at its
 * right, "Viewing" on the open card and "Unassigned" while nobody holds it; what is being planned;
 * the party and the enquiry's age; and the status chip. The open card also takes a peacock stroke
 * over a peacock tint, but the word marks it, never the colour alone.
 *
 * The staff view carries no reference, hotel or client name, and no due time, so T6's "ENQ-0418",
 * hotel title, client and SLA line are not drawn; the card reads nothing beyond the queue's own page
 * (no request per card). The open enquiry's header names its hotel and client.
 */
export function EnquiryQueueCard({ enquiry, selected, onOpen }: EnquiryQueueCardProps) {
  const badge = staffEnquiryBadge[enquiry.status];
  const title = enquiry.functionsSummary ?? ENQUIRY_FALLBACK_TITLE;
  const line = enquiryQueueLine(enquiry);
  const holder = enquiry.assignedUserId === null ? UNASSIGNED_BADGE.label : null;
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  return (
    <Card
      tone="flat"
      padding="none"
      onPress={onOpen}
      accessibilityLabel={[title, badge.label, holder, line, stay].filter(Boolean).join(", ")}
      {...current(selected)}
      className={cn(
        "gap-1.5 rounded-lg bg-transparent px-4 py-3.5",
        selected && "border-highlight/70 bg-highlight/10",
      )}
      testID={`enquiry-card-${enquiry.id}`}
    >
      <Row gap={3} justify="between" align="center">
        <Text variant="data" tone="muted" className="text-xs">
          {formatDayRange(enquiry.dateFrom, enquiry.dateTo, { style: "data" })}
        </Text>
        <Row gap={2} align="center">
          <ViewingMark selected={selected} />
          {holder ? <StatusChip label={holder} tone={UNASSIGNED_BADGE.tone} size="sm" /> : null}
        </Row>
      </Row>
      <Text weight="semibold" numberOfLines={1}>
        {title}
      </Text>
      <Row gap={3} justify="between" align="center">
        <Text variant="bodySmall" tone="muted" numberOfLines={1} className="flex-1">
          {line}
        </Text>
        <StatusChip label={badge.label} tone={badge.tone} size="sm" />
      </Row>
    </Card>
  );
}
