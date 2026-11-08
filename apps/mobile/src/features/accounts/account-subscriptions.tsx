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

function planOf(plans: readonly PlanPublicView[], planId: string): PlanPublicView | undefined {
  return plans.find((plan) => plan.id === planId);
}

/** One subscription: its plan + price, status and dates, plus a Finance action to record a payment. */
function SubscriptionRow({
  subscription,
  plan,
  onRecordPayment,
}: {
  readonly subscription: SubscriptionView;
  readonly plan: PlanPublicView | undefined;
  readonly onRecordPayment: (subscriptionId: string) => void;
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
      {subscription.status === "pending_payment" ? (
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

export interface AccountSubscriptionsProps {
  readonly accountId: string;
  readonly onRecordPayment: (subscriptionId: string) => void;
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
  const planList = plans.data?.items ?? [];
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
        <Card padding="sm">
          <Stack gap={4}>
            {items.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                plan={planOf(planList, subscription.planId)}
                onRecordPayment={onRecordPayment}
              />
            ))}
          </Stack>
        </Card>
      )}
      {plans.isError ? (
        <Text variant="bodySmall" tone="muted">
          Plan names and prices are unavailable right now.
        </Text>
      ) : null}
    </Stack>
  );
}
