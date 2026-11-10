import { clientAmount, type RateItemView } from "@ampm/core";
import { Button, MoneyText, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { rateItemTypeLabel, rateUnitLabel } from "./hotels-admin.format";

export interface RateItemRowProps {
  readonly item: RateItemView;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/**
 * One rate item on a card: its type, the amount or indicative range, the unit, and whether clients see it.
 * The amount is a hotel-published rate rendered as a client figure; the card's own status still gates
 * whether a client-visible item actually reaches discovery.
 */
export function RateItemRow({ item, onEdit, onDelete }: RateItemRowProps) {
  const label = rateItemTypeLabel(item.itemType);
  return (
    <Row gap={3} align="center" justify="between" testID={`rate-item-${item.id}`}>
      <Stack gap={1} className="flex-1">
        <Row gap={2} align="center">
          <Text variant="body" numberOfLines={1} className="flex-1">
            {label}
          </Text>
          <StatusChip
            label={item.clientVisible ? "Client" : "Internal"}
            tone={item.clientVisible ? "success" : "neutral"}
            size="sm"
          />
        </Row>
        <Row gap={2} align="center">
          <MoneyText
            amount={clientAmount(item.amount.minor)}
            amountMax={item.amountMax ? clientAmount(item.amountMax.minor) : null}
          />
          <Text variant="bodySmall" tone="muted">
            {rateUnitLabel(item.unit)}
          </Text>
        </Row>
      </Stack>
      <Row gap={1}>
        <Button
          variant="ghost"
          size="sm"
          icon="edit"
          accessibilityLabel={`Edit ${label}`}
          onPress={onEdit}
          testID={`rate-item-${item.id}-edit`}
        />
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          accessibilityLabel={`Delete ${label}`}
          onPress={onDelete}
          testID={`rate-item-${item.id}-delete`}
        />
      </Row>
    </Row>
  );
}
