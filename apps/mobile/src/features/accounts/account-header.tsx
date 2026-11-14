import type { AccountDetailView } from "@ampm/core";
import { Button, ScreenHeader, StatusChip } from "@ampm/ui";

import { accountFactsLine, accountStatusLabel, accountStatusTone } from "./accounts.format";

export interface AccountHeaderProps {
  /** The loaded account; undefined while it loads or when it failed (the title reads "Client"). */
  readonly account: AccountDetailView | undefined;
  /** The one subscription awaiting payment, whose Record payment the header offers; null for none. */
  readonly pendingSubscriptionId: string | null;
  /** Opens the record-payment sheet; undefined for a reader who may not record one (no action). */
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
  readonly onBack: () => void;
}

/**
 * The client record's header on its own glass panel (the T3 pattern): the account's name once, its
 * status read with it, the facts line under it, and Record payment at the right from 768 (under the
 * facts on a phone) while one subscription waits to be paid and the reader may record it.
 *
 *   <AccountHeader account={account.data} pendingSubscriptionId={id} onRecordPayment={open} onBack={back} />
 */
export function AccountHeader({
  account,
  pendingSubscriptionId,
  onRecordPayment,
  onBack,
}: AccountHeaderProps) {
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
        account && pendingSubscriptionId && onRecordPayment ? (
          <Button
            icon="receipt"
            onPress={() => onRecordPayment(pendingSubscriptionId)}
            testID={`record-payment-${pendingSubscriptionId}`}
          >
            Record payment
          </Button>
        ) : undefined
      }
      onBack={onBack}
      testID="account-header"
    />
  );
}
