import { clientAmount, formatDay, type PlanPublicView, type SubscriptionView } from "@ampm/core";
import { useAccountSubscriptions, usePlans } from "@ampm/api-client";
import {
  Button,
  Card,
  MoneyText,
  Row,
  SectionError,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { subscriptionStatusLabel, subscriptionStatusTone } from "./accounts.format";
import { isAwaitingPayment } from "./use-pending-subscription";

function planOf(plans: readonly PlanPublicView[], planId: string): PlanPublicView | undefined {
  return plans.find((plan) => plan.id === planId);
}

/**
 * One subscription: its plan + price, status and dates, plus the action to record a payment when the
 * reader may and the record header cannot carry it (more than one subscription waits).
 */
function SubscriptionRow({
  subscription,
  plan,
  onRecordPayment,
}: {
  readonly subscription: SubscriptionView;
  readonly plan: PlanPublicView | undefined;
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
}) {
  return (
    <Stack gap={2} testID={`subscription-${subscription.id}`}>
      <Row gap={2} align="center" justify="between">
        <Text variant="body" numberOfLines={1} className="flex-1">
          {plan?.name ?? "Plan"}
        </Text>
        <StatusChip
          label={subscriptionStatusLabel(subscription.status)}
          tone={subscriptionStatusTone(subscription.status)}
          size="sm"
        />
      </Row>
      {plan ? <MoneyText amount={clientAmount(plan.price.minor)} /> : null}
      {subscription.startsAt ? (
        <Text variant="bodySmall" tone="muted">{`Since ${formatDay(subscription.startsAt)}`}</Text>
      ) : null}
      {onRecordPayment && isAwaitingPayment(subscription) ? (
        <Button
          variant="highlight"
          size="sm"
          icon="receipt"
          onPress={() => onRecordPayment(subscription.id)}
          testID={`record-payment-${subscription.id}`}
        >
          Record payment
        </Button>
      ) : null}
    </Stack>
  );
}

interface SubscriptionsCardProps {
  readonly items: readonly SubscriptionView[];
  readonly plans: readonly PlanPublicView[];
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
}

/** The subscriptions as rows in one card. */
function SubscriptionsCard({ items, plans, onRecordPayment }: SubscriptionsCardProps) {
  // One waiting subscription is recorded from the header (useSolePendingSubscription); several each
  // keep their own action here.
  const rowAction = items.filter(isAwaitingPayment).length > 1 ? onRecordPayment : undefined;
  return (
    <Card padding="sm">
      <Stack gap={4}>
        {items.map((subscription) => (
          <SubscriptionRow
            key={subscription.id}
            subscription={subscription}
            plan={planOf(plans, subscription.planId)}
            onRecordPayment={rowAction}
          />
        ))}
      </Stack>
    </Card>
  );
}

export interface AccountSubscriptionsProps {
  readonly accountId: string;
  /**
   * Opens the record-payment sheet; offered on the rows only while several subscriptions wait.
   * Undefined for a reader who may not record a payment: no row offers it.
   */
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
}

/** The account's subscriptions (a sub-query of the account detail); the plan catalogue names + prices them. */
export function AccountSubscriptions({ accountId, onRecordPayment }: AccountSubscriptionsProps) {
  const subscriptions = useAccountSubscriptions(accountId);
  const plans = usePlans();
  // A failed sub-query is shown (offline / retryable), but a refused one (403/404) hides the section —
  // a staff sub-role without subscriptions.read sees nothing here rather than a forever-refused retry.
  if (subscriptions.isError) {
    return (
      <SectionError
        title="Subscriptions"
        error={subscriptions.error}
        onRetry={() => void subscriptions.refetch()}
      />
    );
  }
  const items = subscriptions.data?.items ?? [];
  return (
    <Stack gap={2} testID="account-subscriptions">
      <Text variant="heading">Subscriptions</Text>
      {subscriptions.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : items.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No subscriptions yet. One appears when the client buys a plan.
        </Text>
      ) : (
        <SubscriptionsCard
          items={items}
          plans={plans.data?.items ?? []}
          onRecordPayment={onRecordPayment}
        />
      )}
      {plans.isError ? (
        <Text variant="bodySmall" tone="muted">
          Plan names and prices are unavailable right now.
        </Text>
      ) : null}
    </Stack>
  );
}
