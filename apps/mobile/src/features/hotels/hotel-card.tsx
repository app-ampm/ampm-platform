import type { HotelView } from "@ampm/core";
import { Card, Row, Stack, StatusChip, Text } from "@ampm/ui";

/** Where a hotel sits, as one line: "Udaipur, Rajasthan". */
export function destinationLabel(destination: HotelView["destination"]): string {
  return [destination.name, destination.state].filter(Boolean).join(", ");
}

/** A hotel summary card for the browse list and the shortlist; tapping it opens the detail. */
export function HotelCard({
  hotel,
  onPress,
}: {
  readonly hotel: HotelView;
  readonly onPress: () => void;
}) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${hotel.name} in ${destinationLabel(hotel.destination)}`}
    >
      <Stack gap={1}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" numberOfLines={1} className="flex-1">
            {hotel.name}
          </Text>
          {hotel.starCategory ? (
            <StatusChip label={`${hotel.starCategory}-star`} tone="brand" size="sm" icon="star" />
          ) : null}
        </Row>
        <Text tone="muted" numberOfLines={1}>
          {destinationLabel(hotel.destination)}
        </Text>
        {hotel.description ? (
          <Text tone="muted" numberOfLines={2}>
            {hotel.description}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
