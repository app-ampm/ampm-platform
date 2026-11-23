import type { WeddingReferenceView } from "@ampm/core";
import { Button, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { ReferenceActions } from "./reference-actions";
import {
  referenceConsentChip,
  referenceGuests,
  referenceTitle,
  referenceVisibilityChip,
} from "./references.format";

export interface ReferenceRowProps {
  readonly hotelId: string;
  readonly reference: WeddingReferenceView;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/** The row's edit and remove, named after the reference for screen readers; only for a role that may. */
function RowEditActions({
  reference,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: Omit<ReferenceRowProps, "hotelId">) {
  if (!canUpdate && !canDelete) return null;
  const title = referenceTitle(reference);
  const testID = `reference-${reference.id}`;
  return (
    <Row gap={1}>
      {canUpdate ? (
        <Button
          variant="ghost"
          size="sm"
          icon="edit"
          accessibilityLabel={`Edit the ${title}`}
          onPress={onEdit}
          testID={`${testID}-edit`}
        />
      ) : null}
      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          accessibilityLabel={`Remove the ${title}`}
          onPress={onDelete}
          testID={`${testID}-delete`}
        />
      ) : null}
    </Row>
  );
}

/**
 * One previous wedding at the hotel: its year and guests, whether clients see it and whether the
 * couple's consent is on file (in words, never colour alone), the description clients read, then the
 * consent and visibility actions.
 */
export function ReferenceRow(props: ReferenceRowProps) {
  const { hotelId, reference, canUpdate } = props;
  const visibility = referenceVisibilityChip(reference);
  const consent = referenceConsentChip(reference);
  return (
    <Stack gap={2.5} testID={`reference-${reference.id}`}>
      <Row gap={3} align="start" justify="between">
        <Stack gap={1} className="flex-1">
          <Text variant="body">{referenceTitle(reference)}</Text>
          <Text variant="bodySmall" tone="muted">
            {referenceGuests(reference)}
          </Text>
        </Stack>
        <RowEditActions {...props} />
      </Row>
      {/* Their own full-width row, so a phone keeps both chips on one line beside nothing else. */}
      <Row gap={2} align="center" wrap>
        <StatusChip label={visibility.label} tone={visibility.tone} size="sm" />
        <StatusChip label={consent.label} tone={consent.tone} size="sm" />
      </Row>
      {reference.descriptionClient ? (
        <Text variant="bodySmall" tone="body" numberOfLines={3}>
          {reference.descriptionClient}
        </Text>
      ) : null}
      <ReferenceActions hotelId={hotelId} reference={reference} canUpdate={canUpdate} />
    </Stack>
  );
}
