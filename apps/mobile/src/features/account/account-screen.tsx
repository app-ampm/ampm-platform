import { useMe } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import {
  Callout,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * `/me` with the shared states (standards §2.7 step 5): loading, signed out, offline, error, and the
 * principal with roles, memberships and entitlements. The sign-in flow arrives in sprint 2.
 */
export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Text variant="title">Account</Text>
      {me.isPending ? (
        <Stack gap={2} testID="account-loading">
          <Skeleton shape="text" className="w-48" />
          <Skeleton shape="text" className="w-32" />
          <Skeleton className="h-20 w-full" />
        </Stack>
      ) : me.isError ? (
        <AccountError error={me.error} onRetry={() => void me.refetch()} />
      ) : (
        <Stack gap={3}>
          <Text variant="heading">{me.data.principal.name}</Text>
          <Row gap={2} wrap>
            <StatusChip label={me.data.principal.type} tone="brand" />
            {me.data.roles.map((role) => (
              <StatusChip key={role} label={role} tone="info" />
            ))}
            {me.data.isDemo ? <StatusChip label="demo" tone="warning" /> : null}
          </Row>
          <Text tone="muted">{me.data.principal.email ?? "No email"}</Text>
          <Text variant="label">Memberships</Text>
          {me.data.memberships.length === 0 ? (
            <Text tone="muted">None yet.</Text>
          ) : (
            me.data.memberships.map((m) => (
              <Callout key={m.projectId} kind="info" title={m.projectRole}>
                {`${m.projectId}${m.clientSide ? ` · ${m.clientSide}` : ""}`}
              </Callout>
            ))
          )}
          {me.data.entitlements.modules.length > 0 ? (
            <Row gap={2} wrap>
              {me.data.entitlements.modules.map((module) => (
                <StatusChip key={module} label={module} size="sm" tone="success" />
              ))}
            </Row>
          ) : null}
        </Stack>
      )}
    </ScrollView>
  );
}

function AccountError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to see your account"
        description="Sign-in arrives with the next sprint; development builds use a local token."
      />
    );
  }
  return <ErrorState onRetry={onRetry} />;
}
