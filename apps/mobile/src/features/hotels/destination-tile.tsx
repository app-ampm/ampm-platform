import type { DestinationBrowseItem } from "@ampm/core";
import { Card, Icon, PhotoPlaceholder, Row, Stack, Text } from "@ampm/ui";

import { destinationBrowseSubtitle, hotelCountLabel } from "./hotels.format";

export interface DestinationTileProps {
  readonly item: DestinationBrowseItem;
  readonly onPress: () => void;
}

/**
 * A destination as a desktop tile, in D3's tile pattern: a glass card padded 10 around a 192 photo well
 * (destinations carry no photo yet, so it is the striped stand-in), then the name in Gilda, the region,
 * and the hotel count over a hairline. The whole tile opens the destination's hotels.
 *
 *   <DestinationTile item={udaipur} onPress={() => open(udaipur)} />
 */
export function DestinationTile({ item, onPress }: DestinationTileProps) {
  const where = item.region ?? item.state;
  return (
    <Card
      padding="none"
      onPress={onPress}
      accessibilityLabel={`${item.name}, ${destinationBrowseSubtitle(item)}`}
      className="grow p-2.5 lg:rounded-2xl"
    >
      <PhotoPlaceholder label={`Destination photo · ${item.name}`} className="h-48 w-full" />
      <Stack gap={2.5} className="px-3 pb-2.5 pt-4.5">
        <Text variant="heading" numberOfLines={1}>
          {item.name}
        </Text>
        {where ? (
          <Text variant="bodySmall" tone="muted" numberOfLines={1}>
            {where}
          </Text>
        ) : null}
        <Row justify="between" align="center" className="border-t border-primary/12 pt-2.5">
          <Text variant="data">{hotelCountLabel(item.hotelCount, false)}</Text>
          <Icon name="arrow-right" tone="muted" />
        </Row>
      </Stack>
    </Card>
  );
}
