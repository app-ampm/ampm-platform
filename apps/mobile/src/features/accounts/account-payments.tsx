import { useMe, usePayments } from "@ampm/api-client";
import type { PaymentFinanceView } from "@ampm/core";
import {
  InternalPanel,
  LoadMore,
  Row,
  SectionError,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { rolesGrant } from "@/navigation/staff-areas";

import {
  paymentAmountLabel,
  paymentDirectionLabel,
  paymentDirectionTone,
  paymentMethodLabel,
  paymentPaidLabel,
  paymentPurposeLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from "./payments.format";

const PAYMENTS_PERMISSION = "crm.payments.read";

/** One payment in the finance ledger: amount + status, direction, purpose/method/date, and its reference. */
function PaymentRow({ payment }: { readonly payment: PaymentFinanceView }) {
  return (
    <Stack gap={2} testID={`payment-${payment.id}`}>
      <Row gap={2} align="center" justify="between">
        <Text variant="body" numberOfLines={1} className="flex-1">
          {paymentAmountLabel(payment.amount)}
        </Text>
        <StatusChip
          label={paymentStatusLabel(payment.status)}
          tone={paymentStatusTone(payment.status)}
          size="sm"
        />
      </Row>
      <Row gap={2} align="center" wrap>
        <StatusChip
          label={paymentDirectionLabel(payment.direction)}
          tone={paymentDirectionTone(payment.direction)}
          size="sm"
        />
        <Text variant="bodySmall" tone="muted">
          {`${paymentPurposeLabel(payment.purpose)} · ${paymentMethodLabel(payment.method)} · ${paymentPaidLabel(payment.paidAt)}`}
        </Text>
      </Row>
      {payment.providerRef ? (
        <Text
          variant="bodySmall"
          tone="muted"
          numberOfLines={1}
        >{`Ref ${payment.providerRef}`}</Text>
      ) : null}
    </Stack>
  );
}

export interface AccountPaymentsProps {
  readonly accountId: string;
}

/**
 * The account's payment ledger (RESTRICTED-FINANCE). Shown only to a role that holds `crm.payments.read`
 * (FA/SA): the section is hidden for everyone else and its query is disabled, so a denied role never
 * drives a forever-refused retry — the server is the real gate (denial is a 404). Amounts are internal
 * figures (`InternalPanel`), never a client-facing `MoneyText`.
 */
export function AccountPayments({ accountId }: AccountPaymentsProps) {
  const me = useMe();
  const canRead = me.data ? rolesGrant(me.data.roles, PAYMENTS_PERMISSION) : false;
  const payments = usePayments({ accountId }, { enabled: canRead });
  if (!canRead) return null;
  if (payments.isError) {
    return (
      <SectionError
        title="Payments"
        error={payments.error}
        onRetry={() => void payments.refetch()}
      />
    );
  }
  const items = payments.items;
  return (
    <Stack gap={2} testID="account-payments">
      <Text variant="heading">Payments</Text>
      <InternalPanel label="Finance only — not shown to clients">
        {payments.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : items.length === 0 ? (
          <Text variant="bodySmall" tone="muted">
            No payments recorded yet.
          </Text>
        ) : (
          <Stack gap={4}>
            {items.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
            <LoadMore
              hasMore={payments.hasMore}
              loading={payments.isLoadingMore}
              failed={payments.loadMoreError}
              onLoadMore={payments.loadMore}
              testID="payments-load-more"
            />
          </Stack>
        )}
      </InternalPanel>
    </Stack>
  );
}
