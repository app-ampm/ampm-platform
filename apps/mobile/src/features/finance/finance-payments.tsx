import { usePayments } from "@ampm/api-client";
import type { PaymentFinanceView } from "@ampm/core";
import {
  Card,
  InternalPanel,
  LoadMore,
  Row,
  SectionError,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import {
  paymentAmountLabel,
  paymentMethodLabel,
  paymentStatusTone,
} from "../accounts/payments.format";
import { paymentPillLabel } from "./finance.format";

/**
 * One payment, as T11 lists its milestones: whose, beside its pill (the day it was paid, or its state),
 * then how much and how across the panel's whole width.
 */
function PaymentLine({ payment }: { readonly payment: PaymentFinanceView }) {
  return (
    <Stack gap={1} className="border-t border-primary/10 py-3" testID={`recent-${payment.id}`}>
      <Row gap={2} align="center" justify="between">
        <Text variant="bodySmall" weight="semibold" numberOfLines={1} className="min-w-0 flex-1">
          {payment.accountName}
        </Text>
        <StatusChip
          label={paymentPillLabel(payment)}
          tone={paymentStatusTone(payment.status)}
          size="sm"
        />
      </Row>
      <Text variant="data" tone="muted" numberOfLines={1}>
        {`${paymentAmountLabel(payment.amount)} · ${paymentMethodLabel(payment.method)}`}
      </Text>
    </Stack>
  );
}

function RecentList() {
  const payments = usePayments({ direction: "inbound" });
  if (payments.isError) {
    return (
      <SectionError
        title="Recent payments"
        error={payments.error}
        onRetry={() => void payments.refetch()}
      />
    );
  }
  if (payments.isPending) return <Skeleton className="h-24 w-full" testID="recent-loading" />;
  if (payments.items.length === 0) {
    return (
      <Text variant="bodySmall" tone="muted" testID="recent-empty">
        No payments yet.
      </Text>
    );
  }
  return (
    <Stack>
      {payments.items.map((payment) => (
        <PaymentLine key={payment.id} payment={payment} />
      ))}
      <LoadMore
        hasMore={payments.hasMore}
        loading={payments.isLoadingMore}
        failed={payments.loadMoreError}
        onLoadMore={payments.loadMore}
        testID="recent-load-more"
      />
    </Stack>
  );
}

/**
 * T11's side panel, on Phase 1's data: clients' payments newest first, gateway attempts and recorded
 * transfers alike, from the finance ledger (RESTRICTED-FINANCE). The screen renders it only for a role holding
 * `crm.payments.read` (Finance, the Super Admin) and leaves it out for Sales (W-5); its amounts are
 * finance figures, so they sit in the `InternalPanel` as on the account page.
 */
export function FinancePayments() {
  return (
    <Card padding="md" testID="finance-payments">
      <Stack gap={3}>
        <Text variant="heading">Recent payments</Text>
        <InternalPanel label="Finance only — not shown to clients">
          <RecentList />
        </InternalPanel>
        <Text variant="caption" tone="muted">
          Clients pay through the gateway or by bank transfer. A gateway payment activates its
          subscription by itself; record a transfer once it reaches the bank.
        </Text>
      </Stack>
    </Card>
  );
}
