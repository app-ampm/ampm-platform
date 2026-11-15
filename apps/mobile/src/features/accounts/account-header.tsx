import type { AccountDetailView } from "@ampm/core";
import { Button, Row, ScreenHeader, StatusChip } from "@ampm/ui";

import { accountFactsLine, accountStatusLabel, accountStatusTone } from "./accounts.format";

export interface AccountHeaderProps {
  /** The loaded account; undefined while it loads or when it failed (the title reads "Client"). */
  readonly account: AccountDetailView | undefined;
  /** The one subscription awaiting payment, whose Record payment the header offers; null for none. */
  readonly pendingSubscriptionId: string | null;
  /** Opens the record-payment sheet; undefined for a reader who may not record one (no action). */
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
  /** Opens the edit-details sheet; undefined for a reader who may not edit the account. */
  readonly onEditDetails: (() => void) | undefined;
  readonly onBack: () => void;
}

/** The header's actions: Edit details (secondary), then Record payment (the one gold action). */
function HeaderActions({
  onEditDetails,
  recordId,
  onRecordPayment,
}: {
  readonly onEditDetails: (() => void) | undefined;
  readonly recordId: string | null;
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
}) {
  return (
    <Row gap={2} wrap>
      {onEditDetails ? (
        <Button
          variant="secondary"
          icon="edit"
          onPress={onEditDetails}
          testID="account-edit-details"
        >
          Edit details
        </Button>
      ) : null}
      {recordId !== null && onRecordPayment ? (
        <Button
          icon="receipt"
          onPress={() => onRecordPayment(recordId)}
          testID={`record-payment-${recordId}`}
        >
          Record payment
        </Button>
      ) : null}
    </Row>
  );
}

/**
 * The client record's header on its own glass panel (the T3 pattern): the account's name once, its
 * status read with it, the facts line under it, and its actions at the right from 768 (under the facts
 * on a phone): Edit details for a role that may edit, and Record payment — the one gold action — while
 * one subscription waits to be paid and the reader may record it.
 *
 *   <AccountHeader account={account.data} pendingSubscriptionId={id} onRecordPayment={open}
 *     onEditDetails={edit} onBack={back} />
 */
export function AccountHeader({
  account,
  pendingSubscriptionId,
  onRecordPayment,
  onEditDetails,
  onBack,
}: AccountHeaderProps) {
  const recordId = account && onRecordPayment ? pendingSubscriptionId : null;
  const editDetails = account ? onEditDetails : undefined;
  return (
    <ScreenHeader
      variant="panel"
      title={account?.name ?? "Client"}
      badge={
        account ? (
          <StatusChip
            label={accountStatusLabel(account.status)}
            tone={accountStatusTone(account.status)}
          />
        ) : undefined
      }
      subtitle={account ? accountFactsLine(account) : undefined}
      actions={
        recordId !== null || editDetails ? (
          <HeaderActions
            onEditDetails={editDetails}
            recordId={recordId}
            onRecordPayment={onRecordPayment}
          />
        ) : undefined
      }
      onBack={onBack}
      testID="account-header"
    />
  );
}
