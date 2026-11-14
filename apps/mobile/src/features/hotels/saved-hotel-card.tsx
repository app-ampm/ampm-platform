import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { HotelView, SavedHotelView } from "@ampm/core";
import { cn, MoneyText, Row, Stack, StatusChip, Text } from "@ampm/ui";
import { focusRingStyles } from "@ampm/ui/styles";

import { shortFreshnessChip } from "./hotel-compare.format";
import {
  capacityRangeLabel,
  destinationLabel,
  priceRangeAmounts,
  priceRangeUnit,
  roomsLabel,
  starLabel,
} from "./hotels.format";
import { SavedHotelActions } from "./saved-hotel-actions";
import { SavedHotelPhoto } from "./saved-hotel-photo";
import { savedHotelLabel, useSavedHotelRemoval } from "./use-saved-hotel-controls";

export interface SavedHotelCardProps {
  readonly item: SavedHotelView;
  /** The column's place in the grid: the photo stand-ins alternate gold and peacock bands, as D7's do. */
  readonly index: number;
  readonly onOpen: () => void;
  /** Opens the screen's note sheet for this entry (the screen holds it, so it outlives this column). */
  readonly onEditNote: () => void;
  /** In compare mode the note and remove buttons give way to the compare pick. */
  readonly comparePick?: ReactNode;
}

/**
 * One hotel of the shortlist on a desktop, as a D7 column: its 130 photo and Gilda name (together opening
 * the hotel), then the at-a-glance facts as hairline rows (where, seats, rooms, indicative price and the
 * rates' freshness), the client's own note (B15), and the note and remove buttons — or, while picking
 * hotels to compare, the compare checkbox.
 */
export function SavedHotelCard({
  item,
  index,
  onOpen,
  onEditNote,
  comparePick,
}: SavedHotelCardProps) {
  const removal = useSavedHotelRemoval(item);
  return (
    <Stack gap={3} className="h-full" testID={`saved-card-${item.hotel.id}`}>
      <CardHeading item={item} index={index} onOpen={onOpen} />
      <SavedFacts hotel={item.hotel} />
      {item.note ? (
        <Text variant="bodySmall" tone="muted" className="flex-1">
          {item.note}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      {comparePick ?? (
        <SavedHotelActions
          item={item}
          removal={removal}
          onEditNote={onEditNote}
          variant="labelled"
        />
      )}
    </Stack>
  );
}

function CardHeading({
  item,
  index,
  onOpen,
}: Omit<SavedHotelCardProps, "comparePick" | "onEditNote">) {
  const { hotel } = item;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={savedHotelLabel(item)}
      onPress={onOpen}
      className={cn(
        "gap-2.5 rounded-lg border border-transparent web:cursor-pointer",
        focusRingStyles,
      )}
    >
      <SavedHotelPhoto
        hotel={hotel}
        tone={index % 2 === 0 ? "gold" : "peacock"}
        className="h-32 w-full rounded-lg"
      />
      <Row gap={2} justify="between" align="start">
        <Text variant="heading" className="flex-1">
          {hotel.name}
        </Text>
        {hotel.starCategory ? (
          <StatusChip label={starLabel(hotel.starCategory)} tone="brand" size="sm" />
        ) : null}
      </Row>
    </Pressable>
  );
}

/** The figures a planner weighs, each from the card summary the shortlist already carries (B11). */
function SavedFacts({ hotel }: { readonly hotel: HotelView }) {
  const { summary } = hotel;
  const chip = shortFreshnessChip(summary.ratesFreshness, summary.ratesAsOf);
  return (
    <View>
      <Fact label="Destination">
        <Text variant="bodySmall" tone="primary">
          {destinationLabel(hotel.destination)}
        </Text>
      </Fact>
      {summary.capacity ? (
        <Fact label="Capacity">
          <Text variant="bodySmall" tone="primary">
            {capacityRangeLabel(summary.capacity)}
          </Text>
        </Fact>
      ) : null}
      {hotel.totalRooms != null ? (
        <Fact label="Rooms">
          <Text variant="bodySmall" tone="primary">
            {roomsLabel(hotel.totalRooms)}
          </Text>
        </Fact>
      ) : null}
      {summary.priceRange ? (
        <Fact label="Price">
          <Row gap={1} align="center" wrap>
            <MoneyText {...priceRangeAmounts(summary.priceRange)} />
            <Text variant="caption" tone="muted">
              {priceRangeUnit(summary.priceRange.unit)}
            </Text>
          </Row>
        </Fact>
      ) : null}
      <Fact label="Rates">
        <StatusChip label={chip.label} tone={chip.tone} dot={chip.dot} size="sm" />
      </Fact>
    </View>
  );
}

/** One fact row: D7's 11px tracked label at the left, the value after it, a hairline above. */
function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Row gap={3} align="center" className="border-t border-primary/10 py-2.5">
      <Text variant="caption" tone="muted" className="w-24 uppercase tracking-label">
        {label}
      </Text>
      <View className="min-w-0 flex-1 items-start">{children}</View>
    </Row>
  );
}
