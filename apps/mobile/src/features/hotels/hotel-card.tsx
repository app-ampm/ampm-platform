import { View } from "react-native";

import type { HotelCardSummary, HotelView } from "@ampm/core";
import { Card, cn, MoneyText, PhotoPlaceholder, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import {
  capacityRangeLabel,
  cardFreshnessChip,
  cardSummaryAccessibilityLabel,
  destinationLabel,
  hotelMetaLine,
  priceRangeAmounts,
  priceRangeUnit,
  starLabel,
} from "./hotels.format";

export interface HotelCardProps {
  readonly hotel: HotelView;
  readonly onPress: () => void;
  /** Extra classes for the card, such as `grow` to fill a grid cell beside a taller neighbour. */
  readonly className?: string | undefined;
}

/** The card's photo: the hotel's cover when it has a client-visible image, else the striped stand-in. */
function HotelCardPhoto({ hotel }: { readonly hotel: HotelView }) {
  return hotel.coverUrl ? (
    <MediaImage
      uri={hotel.coverUrl}
      alt={`Photo of ${hotel.name}`}
      radius="none"
      className="h-32 w-full rounded md:h-auto md:min-h-32 md:w-48"
    />
  ) : (
    <PhotoPlaceholder
      label={`Hotel photo · ${hotel.destination.name}`}
      className="h-32 w-full rounded md:h-auto md:min-h-32 md:w-48"
    />
  );
}

/**
 * The card's at-a-glance figures (B11): an indicative client price range with a compact freshness chip and
 * the venue capacity range. Every figure is derived from the same verified/stale, client-visible rate cards
 * and descriptive venue capacities the detail serves — the card leaks nothing new (security.md). A hotel
 * with no client-visible price shows the freshness chip alone ("On request"); one with no venues omits seats.
 */
function CardSummary({ summary }: { readonly summary: HotelCardSummary }) {
  const chip = cardFreshnessChip(summary);
  return (
    <Stack gap={1}>
      <Row gap={2} justify="between" align="center">
        {summary.priceRange ? (
          <Row gap={1} align="center" className="flex-1">
            <MoneyText {...priceRangeAmounts(summary.priceRange)} variant="label" />
            <Text variant="caption" tone="muted">
              {priceRangeUnit(summary.priceRange.unit)}
            </Text>
          </Row>
        ) : (
          <View className="flex-1" />
        )}
        <StatusChip label={chip.label} tone={chip.tone} dot={chip.dot} size="sm" />
      </Row>
      {summary.capacity ? (
        <Text variant="data" tone="muted" numberOfLines={1}>
          {capacityRangeLabel(summary.capacity)}
        </Text>
      ) : null}
    </Stack>
  );
}

/**
 * A search result (D5, P3): a glass card with the hotel's cover photo on top (beside the text from a tablet
 * up), the name in Gilda Display, where the hotel is as data, its star category, two lines of description
 * and, at a glance, the indicative price range, rates freshness and capacity (B11). The whole card opens the
 * hotel. The cover is the hotel's primary client-visible image (a signed link); a hotel with no such image
 * keeps the striped stand-in.
 */
export function HotelCard({ hotel, onPress, className }: HotelCardProps) {
  return (
    <Card
      padding="none"
      onPress={onPress}
      accessibilityLabel={`${hotel.name} in ${destinationLabel(hotel.destination)}. ${cardSummaryAccessibilityLabel(hotel.summary)}`}
      className={cn("gap-1 p-2 md:flex-row md:gap-4", className)}
    >
      <HotelCardPhoto hotel={hotel} />
      <View className="gap-1.5 px-2 pb-2 pt-2 md:flex-1 md:px-0">
        <Row gap={2} justify="between" align="start">
          <Text variant="heading" numberOfLines={2} className="flex-1">
            {hotel.name}
          </Text>
          {hotel.starCategory ? (
            <StatusChip label={starLabel(hotel.starCategory)} tone="brand" size="sm" icon="star" />
          ) : null}
        </Row>
        <Text variant="data" tone="muted" numberOfLines={1}>
          {hotelMetaLine(hotel)}
        </Text>
        {hotel.description ? (
          <Text variant="bodySmall" numberOfLines={2}>
            {hotel.description}
          </Text>
        ) : null}
        <CardSummary summary={hotel.summary} />
      </View>
    </Card>
  );
}
