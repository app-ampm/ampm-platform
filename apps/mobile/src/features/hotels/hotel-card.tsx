import { View } from "react-native";

import type { HotelView } from "@ampm/core";
import { Card, PhotoPlaceholder, Row, StatusChip, Text } from "@ampm/ui";

import { destinationLabel, hotelMetaLine, starLabel } from "./hotels.format";

export interface HotelCardProps {
  readonly hotel: HotelView;
  readonly onPress: () => void;
}

/**
 * A search result (D5, P3): a glass card with the photo stand-in on top (beside the text from a
 * tablet up), the name in Gilda Display, where the hotel is as data, its star category and two lines
 * of description. The whole card opens the hotel. The list view (`hotelView`) carries no picture and
 * no rates, so the photo stays a placeholder and the card shows no price or verified-rate chip.
 */
export function HotelCard({ hotel, onPress }: HotelCardProps) {
  return (
    <Card
      padding="none"
      onPress={onPress}
      accessibilityLabel={`${hotel.name} in ${destinationLabel(hotel.destination)}`}
      className="gap-1 p-2 md:flex-row md:gap-4"
    >
      <PhotoPlaceholder
        label={`Hotel photo · ${hotel.destination.name}`}
        className="h-32 w-full rounded md:h-auto md:min-h-32 md:w-48"
      />
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
      </View>
    </Card>
  );
}
