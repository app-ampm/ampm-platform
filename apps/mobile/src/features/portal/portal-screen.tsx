import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useCompletePayment, useMe, usePlans, usePortalSubscribe } from "@ampm/api-client";
import { clientAmount, isAppError, type PlanPublicView } from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  MoneyText,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

/** The client portal (feature CP-11): buy the hotel-discovery plan and watch the entitlement unlock. */
export function PortalScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const plans = usePlans();
  const unlocked = me.data?.entitlements.hotelReach.includes("all_hotels") ?? false;
  const canBrowse = me.data?.entitlements.modules.includes("hotel_discovery") ?? false;
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <PortalHeader name={me.data?.principal.name} />
      {me.isError ? (
        <MeError error={me.error} onRetry={() => void me.refetch()} />
      ) : (
        <Stack gap={4}>
          <EntitlementBand unlocked={unlocked} canBrowse={canBrowse} loading={me.isPending} />
          <PlanList plans={plans} unlocked={unlocked} />
        </Stack>
      )}
    </ScrollView>
  );
}

/** Title, the signed-in client, and sign-out (clears the token and cached data). */
function PortalHeader({ name }: { readonly name: string | undefined }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = (): void => {
    setAccessToken(null);
    queryClient.clear();
    router.replace("/sign-in");
  };
  return (
    <Row gap={2} justify="between" align="start">
      <Stack gap={0}>
        <Text variant="title">Your plan</Text>
        {name ? <Text tone="muted">{`Signed in as ${name}`}</Text> : null}
      </Stack>
      <Button variant="ghost" size="sm" onPress={signOut}>
        Sign out
      </Button>
    </Row>
  );
}

function MeError({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to view your plan"
        action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  return <ErrorState onRetry={onRetry} />;
}

function EntitlementBand({
  unlocked,
  canBrowse,
  loading,
}: {
  readonly unlocked: boolean;
  readonly canBrowse: boolean;
  readonly loading: boolean;
}) {
  const router = useRouter();
  if (loading) return <Skeleton className="h-16 w-full" />;
  if (unlocked) {
    return (
      <Stack gap={2}>
        <Callout kind="verified" title="Hotel discovery unlocked">
          You can now search all hotels.
        </Callout>
        <Button icon="search" onPress={() => router.push("/hotels")}>
          Browse hotels
        </Button>
      </Stack>
    );
  }
  // A demo / project / agreement principal reaches its own scoped set without a full subscription.
  if (canBrowse) {
    return (
      <Stack gap={2}>
        <Callout kind="indicative" title="Browse hotels">
          Explore the hotels available to you.
        </Callout>
        <Button variant="secondary" icon="search" onPress={() => router.push("/hotels")}>
          Browse hotels
        </Button>
      </Stack>
    );
  }
  return <Callout kind="indicative" title="Subscribe to unlock full hotel discovery" />;
}

function PlanList({
  plans,
  unlocked,
}: {
  readonly plans: ReturnType<typeof usePlans>;
  readonly unlocked: boolean;
}) {
  if (plans.isPending) return <PortalLoading />;
  if (plans.isError) {
    return isAppError(plans.error) && plans.error.code === "network_error" ? (
      <OfflineState onRetry={() => void plans.refetch()} />
    ) : (
      <ErrorState onRetry={() => void plans.refetch()} />
    );
  }
  if (plans.data.items.length === 0) {
    return <EmptyState icon="inbox" title="No plans available yet" />;
  }
  return (
    <Stack gap={3}>
      {plans.data.items.map((plan) => (
        <PlanCard key={plan.id} plan={plan} unlocked={unlocked} />
      ))}
    </Stack>
  );
}

function PlanCard({
  plan,
  unlocked,
}: {
  readonly plan: PlanPublicView;
  readonly unlocked: boolean;
}) {
  const toast = useToast();
  const subscribe = usePortalSubscribe();
  const complete = useCompletePayment();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onSubscribe = (): void => {
    subscribe.mutate(
      { planId: plan.id },
      {
        onSuccess: (result) => setPendingId(result.subscriptionId),
        onError: () => toast.show({ title: "Could not start the subscription", tone: "danger" }),
      },
    );
  };
  const onComplete = (): void => {
    if (!pendingId) return;
    complete.mutate(
      { subscriptionId: pendingId },
      { onError: () => toast.show({ title: "Could not complete the payment", tone: "danger" }) },
    );
  };

  return (
    <Card>
      <Stack gap={2}>
        <PlanSummary plan={plan} unlocked={unlocked} />
        <PlanAction
          unlocked={unlocked}
          pending={pendingId !== null}
          subscribing={subscribe.isPending}
          activating={complete.isPending || complete.isSuccess}
          onSubscribe={onSubscribe}
          onComplete={onComplete}
        />
      </Stack>
    </Card>
  );
}

function PlanSummary({
  plan,
  unlocked,
}: {
  readonly plan: PlanPublicView;
  readonly unlocked: boolean;
}) {
  return (
    <Stack gap={2}>
      <Row gap={2} justify="between" align="start">
        <Text variant="subheading" className="flex-1">
          {plan.name}
        </Text>
        {unlocked ? <StatusChip label="Active" tone="success" /> : null}
      </Row>
      <MoneyText amount={clientAmount(plan.price.minor, plan.price.currency)} variant="title" />
      {plan.termDays !== null ? <Text tone="muted">{`${plan.termDays} days`}</Text> : null}
      <Row gap={2} wrap>
        {plan.modules.map((module) => (
          <StatusChip
            key={module.moduleKey}
            label={module.moduleKey.replace(/_/g, " ")}
            tone="info"
            size="sm"
          />
        ))}
      </Row>
    </Stack>
  );
}

function PlanAction({
  unlocked,
  pending,
  subscribing,
  activating,
  onSubscribe,
  onComplete,
}: {
  readonly unlocked: boolean;
  readonly pending: boolean;
  readonly subscribing: boolean;
  readonly activating: boolean;
  readonly onSubscribe: () => void;
  readonly onComplete: () => void;
}) {
  if (unlocked) return null;
  if (!pending) {
    return (
      <Button fullWidth loading={subscribing} onPress={onSubscribe}>
        Subscribe
      </Button>
    );
  }
  return (
    <Stack gap={2}>
      <Callout kind="awaiting-confirmation" title="Payment pending">
        Complete the payment to activate your subscription.
      </Callout>
      {/* `activating` stays true from the first tap through the /me refetch, so the button can't be re-tapped. */}
      <Button fullWidth loading={activating} disabled={activating} onPress={onComplete}>
        Complete payment (demo)
      </Button>
    </Stack>
  );
}

function PortalLoading() {
  return (
    <Stack gap={2} testID="portal-loading">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}
