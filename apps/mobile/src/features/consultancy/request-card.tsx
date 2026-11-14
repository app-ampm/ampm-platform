import { useHotel } from "@ampm/api-client";
import { formatDay, formatDayRange, type HotelEnquiryClientView } from "@ampm/core";
import { Card, cn, Row, StatusChip, Text } from "@ampm/ui";

import { enquiryChip, guestsLabel } from "./consultancy.format";
import { ViewingMark } from "./viewing-mark";

export interface RequestCardProps {
  readonly enquiry: HotelEnquiryClientView;
  /** The enquiry open beside the list. */
  readonly selected: boolean;
  readonly onOpen: () => void;
}

const CARD = "gap-1.5 rounded-lg bg-transparent";
const SELECTED = "border-primary/30 bg-highlight/10";

/** Screen readers hear the open card as the current one (selected natively, aria-current on the web). */
const current = (selected: boolean) =>
  selected ? { "aria-current": "true" as const, accessibilityState: { selected: true } } : {};

/**
 * One enquiry in D8's desktop list: the hotel and the day it last moved, the stay and the party, then
 * its status chip. The open one is selected: a peacock tint under a stronger pearl stroke (peacock is
 * what is selected), and the word "Viewing" by its chip, so it never rests on colour alone; a closed
 * one reads quieter. A phone keeps `RequestRow`.
 */
export function RequestCard({ enquiry, selected, onOpen }: RequestCardProps) {
  const hotel = useHotel(enquiry.hotelId);
  const chip = enquiryChip(enquiry);
  const title = hotel.data?.name ?? "Hotel request";
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  const party = guestsLabel(enquiry.guestEstimate);
  const updated = formatDay(enquiry.updatedAt, { style: "data" });
  return (
    <Card
      tone="flat"
      padding="sm"
      onPress={onOpen}
      accessibilityLabel={`${title}, ${chip.label}, ${stay}, ${party}, updated ${updated}`}
      {...current(selected)}
      className={cn(CARD, selected && SELECTED)}
      testID={`request-card-${enquiry.id}`}
    >
      <Row gap={3} justify="between" align="start">
        <Text
          weight="semibold"
          tone={enquiry.status === "closed" ? "muted" : "primary"}
          numberOfLines={1}
          className="flex-1"
        >
          {title}
        </Text>
        <Text variant="data" tone="muted" className="text-xs">
          {updated}
        </Text>
      </Row>
      <Text variant="bodySmall" tone="muted">{`${stay} · ${party}`}</Text>
      <Row gap={3} justify="between" align="center">
        <StatusChip label={chip.label} tone={chip.tone} size="sm" />
        <ViewingMark selected={selected} />
      </Row>
    </Card>
  );
}
