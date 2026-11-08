import { useState } from "react";

import { useDeleteRateCard, useDeleteRateItem } from "@ampm/api-client";
import type { RateCardView, RateItemView } from "@ampm/core";
import { Button, Card, Row, Stack, StatusChip, Text, useToast } from "@ampm/ui";

import { ConfirmSheet } from "../admin/confirm-sheet";
import { rateCardStatusLabel, rateCardStatusTone } from "./hotels-admin.format";
import { RateCardEditSheet } from "./rate-card-edit-sheet";
import { RateItemEditSheet } from "./rate-item-edit-sheet";
import { RateItemRow } from "./rate-item-row";
import { VerifyCardSheet } from "./verify-card-sheet";

/** The edit / verify / delete state for one rate card and its items, kept out of the view. */
function useRateCardPanel(hotelId: string, card: RateCardView) {
  const toast = useToast();
  const deleteCard = useDeleteRateCard(hotelId);
  const deleteItem = useDeleteRateItem(hotelId);
  const [editingCard, setEditingCard] = useState<{ readonly card: RateCardView } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [itemEditing, setItemEditing] = useState<{ readonly item: RateItemView | null } | null>(
    null,
  );
  const [itemDeleting, setItemDeleting] = useState<RateItemView | null>(null);
  const confirmDeleteCard = (): void => {
    if (deleteCard.isPending) return;
    deleteCard.mutate(card.id, {
      onSuccess: () => {
        toast.show({ title: `${card.name} removed`, tone: "success" });
        setDeletingCard(false);
      },
      onError: () => toast.show({ title: "Could not remove the rate card", tone: "danger" }),
    });
  };
  const confirmDeleteItem = (): void => {
    if (!itemDeleting || deleteItem.isPending) return;
    deleteItem.mutate(
      { cardId: card.id, itemId: itemDeleting.id },
      {
        onSuccess: () => {
          toast.show({ title: "Rate item removed", tone: "success" });
          setItemDeleting(null);
        },
        onError: () => toast.show({ title: "Could not remove the rate item", tone: "danger" }),
      },
    );
  };
  return {
    editingCard,
    setEditingCard,
    verifying,
    setVerifying,
    deletingCard,
    setDeletingCard,
    itemEditing,
    setItemEditing,
    itemDeleting,
    setItemDeleting,
    confirmDeleteCard,
    confirmDeleteItem,
    cardDeletePending: deleteCard.isPending,
    itemDeletePending: deleteItem.isPending,
  };
}

type Panel = ReturnType<typeof useRateCardPanel>;

/** The card's name, status, validity and its edit / verify / delete actions. */
function RateCardHeader({
  card,
  onEdit,
  onVerify,
  onDelete,
}: {
  readonly card: RateCardView;
  readonly onEdit: () => void;
  readonly onVerify: () => void;
  readonly onDelete: () => void;
}) {
  const canVerify = card.status === "draft" || card.status === "stale";
  return (
    <Stack gap={2}>
      <Row gap={2} align="center" justify="between">
        <Text variant="heading" numberOfLines={1} className="flex-1">
          {card.name}
        </Text>
        <StatusChip
          label={rateCardStatusLabel(card.status)}
          tone={rateCardStatusTone(card.status)}
          size="sm"
        />
      </Row>
      {card.validFrom || card.validTo ? (
        <Text
          variant="bodySmall"
          tone="muted"
        >{`${card.validFrom ?? "—"} to ${card.validTo ?? "—"}`}</Text>
      ) : null}
      <Row gap={2} wrap>
        <Button
          variant="secondary"
          size="sm"
          icon="edit"
          onPress={onEdit}
          testID={`rate-card-${card.id}-edit`}
        >
          Edit
        </Button>
        {canVerify ? (
          <Button
            variant="highlight"
            size="sm"
            icon="check"
            onPress={onVerify}
            testID={`rate-card-${card.id}-verify`}
          >
            Verify
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          accessibilityLabel={`Delete ${card.name}`}
          onPress={onDelete}
          testID={`rate-card-${card.id}-delete`}
        />
      </Row>
    </Stack>
  );
}

/** The card's rate items, with an action to add one. */
function RateCardItems({
  card,
  onAdd,
  onEdit,
  onDelete,
}: {
  readonly card: RateCardView;
  readonly onAdd: () => void;
  readonly onEdit: (item: RateItemView) => void;
  readonly onDelete: (item: RateItemView) => void;
}) {
  return (
    <Stack gap={3}>
      <Row justify="between" align="center">
        <Text variant="label">Items</Text>
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          onPress={onAdd}
          testID={`rate-card-${card.id}-add-item`}
        >
          Add item
        </Button>
      </Row>
      {card.items.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No items yet. Add the rates this card covers.
        </Text>
      ) : (
        <Stack gap={3}>
          {card.items.map((item) => (
            <RateItemRow
              key={item.id}
              item={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/** The card's own editors, verify sheet and the two remove confirms. */
function RateCardSheets({
  hotelId,
  card,
  panel,
}: {
  readonly hotelId: string;
  readonly card: RateCardView;
  readonly panel: Panel;
}) {
  return (
    <>
      <RateCardEditSheet
        hotelId={hotelId}
        open={panel.editingCard !== null}
        card={panel.editingCard?.card ?? null}
        onClose={() => panel.setEditingCard(null)}
      />
      <RateItemEditSheet
        hotelId={hotelId}
        cardId={card.id}
        open={panel.itemEditing !== null}
        item={panel.itemEditing?.item ?? null}
        onClose={() => panel.setItemEditing(null)}
      />
      <VerifyCardSheet
        hotelId={hotelId}
        cardId={panel.verifying ? card.id : null}
        onClose={() => panel.setVerifying(false)}
      />
      <ConfirmSheet
        open={panel.deletingCard}
        onClose={() => panel.setDeletingCard(false)}
        title={`Remove ${card.name}?`}
        description="This removes the rate card and its items from the hotel."
        confirmLabel="Remove"
        destructive
        loading={panel.cardDeletePending}
        onConfirm={panel.confirmDeleteCard}
        testID={`rate-card-${card.id}-remove`}
      />
      <ConfirmSheet
        open={panel.itemDeleting !== null}
        onClose={() => panel.setItemDeleting(null)}
        title="Remove rate item?"
        description="This removes the rate item from the card."
        confirmLabel="Remove"
        destructive
        loading={panel.itemDeletePending}
        onConfirm={panel.confirmDeleteItem}
        testID={`rate-item-remove-${card.id}`}
      />
    </>
  );
}

export interface RateCardPanelProps {
  readonly hotelId: string;
  readonly card: RateCardView;
}

/** One rate card: its header, its items, and the editors / verify / deletes it owns. */
export function RateCardPanel({ hotelId, card }: RateCardPanelProps) {
  const panel = useRateCardPanel(hotelId, card);
  return (
    <Card testID={`rate-card-panel-${card.id}`}>
      <Stack gap={4}>
        <RateCardHeader
          card={card}
          onEdit={() => panel.setEditingCard({ card })}
          onVerify={() => panel.setVerifying(true)}
          onDelete={() => panel.setDeletingCard(true)}
        />
        <RateCardItems
          card={card}
          onAdd={() => panel.setItemEditing({ item: null })}
          onEdit={(item) => panel.setItemEditing({ item })}
          onDelete={(item) => panel.setItemDeleting(item)}
        />
      </Stack>
      <RateCardSheets hotelId={hotelId} card={card} panel={panel} />
    </Card>
  );
}
