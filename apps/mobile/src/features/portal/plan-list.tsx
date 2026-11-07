import { View } from "react-native";

import { usePlans } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { EmptyState, ErrorState, OfflineState, Skeleton, Stack } from "@ampm/ui";

import { PlanCard } from "./plan-card";

/** The plan catalogue (`GET /crm/plans`) as payment cards, with its loading, error, offline and empty states. */
export function PlanList() {
  const plans = usePlans();
  if (plans.isPending) {
    return (
      <View testID="portal-plans-loading" accessible accessibilityLabel="Loading plans">
        <Skeleton className="h-96 w-full rounded-lg" />
      </View>
    );
  }
  if (plans.isError) {
    const retry = (): void => void plans.refetch();
    return isAppError(plans.error) && plans.error.code === "network_error" ? (
      <OfflineState onRetry={retry} />
    ) : (
      <ErrorState onRetry={retry} />
    );
  }
  if (plans.data.items.length === 0) {
    return <EmptyState icon="inbox" title="No plans available yet" />;
  }
  // One gold primary per screen: a lone plan's pay button is it; competing plans pay through secondary ones.
  const payVariant = plans.data.items.length === 1 ? "primary" : "secondary";
  return (
    <Stack gap={4}>
      {plans.data.items.map((plan) => (
        <PlanCard key={plan.id} plan={plan} payVariant={payVariant} />
      ))}
    </Stack>
  );
}
