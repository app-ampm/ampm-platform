import { clientAmount, ratePercentLabel, type RateItemView } from "@ampm/core";
import { Button, MoneyText, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { rateItemName, rateUnitLabel, type RateItemPlaces } from "./hotels-admin.format";

export interface RateItemRowProps {
  readonly item: RateItemView;
  /** The hotel's live rooms and venues, which name what an item prices; undefined until it loads. */
  readonly places: RateItemPlaces | undefined;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/**
 * An item's price: a percent item's percentage ("10%", "18–20%"; its amounts hold hundredths), else the
 * amount or indicative range in rupees and its unit.
 */
function RateItemPrice({ item }: { readonly item: RateItemView }) {
  if (item.unit === "percent") {
    return (
      <Text variant="data" weight="semibold" tone="primary">
        {ratePercentLabel(item)}
      </Text>
    );
  }
  return (
    <Row gap={2} align="center">
      <MoneyText
        amount={clientAmount(item.amount.minor)}
        amountMax={item.amountMax ? clientAmount(item.amountMax.minor) : null}
      />
      <Text variant="bodySmall" tone="muted">
        {rateUnitLabel(item.unit)}
      </Text>
    </Row>
  );
}

/**
 * One rate item on a card: its type and the room category or venue it prices (TW-23), its price, and
 * whether clients see it. The amount is a hotel-published rate rendered as a client figure; the card's
 * own status still gates whether a client-visible item actually reaches discovery.
 */
export function RateItemRow({ item, places, onEdit, onDelete }: RateItemRowProps) {
  const { title, spoken } = rateItemName(item, places);
  return (
    <Row gap={3} align="center" justify="between" testID={`rate-item-${item.id}`}>
      <Stack gap={1} className="flex-1">
        <Row gap={2} align="center">
          <Text variant="body" numberOfLines={2} className="flex-1">
            {title}
          </Text>
          <StatusChip
            label={item.clientVisible ? "Client" : "Internal"}
            tone={item.clientVisible ? "success" : "neutral"}
            size="sm"
          />
        </Row>
        <RateItemPrice item={item} />
      </Stack>
      <Row gap={1}>
        <Button
          variant="ghost"
          size="sm"
          icon="edit"
          accessibilityLabel={`Edit ${spoken}`}
          onPress={onEdit}
          testID={`rate-item-${item.id}-edit`}
        />
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          accessibilityLabel={`Delete ${spoken}`}
          onPress={onDelete}
          testID={`rate-item-${item.id}-delete`}
        />
      </Row>
    </Row>
  );
}
