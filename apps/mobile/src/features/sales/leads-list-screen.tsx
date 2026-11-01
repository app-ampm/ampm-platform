import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useLeads, useMe } from "@ampm/api-client";
import { isAppError, type LeadView } from "@ampm/core";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

/** The Sales lead pipeline: incoming enquiries (first page), newest first; each row opens the detail. */
export function LeadsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const leads = useLeads();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <WorkspaceHeader />
      {leads.isPending ? (
        <LeadsLoading />
      ) : leads.isError ? (
        <LeadsError error={leads.error} onRetry={() => void leads.refetch()} />
      ) : leads.data.items.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No enquiries yet"
          description="New enquiries from the website land here."
        />
      ) : (
        <Stack gap={2}>
          {leads.data.items.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              onPress={() => router.push({ pathname: "/leads/[id]", params: { id: lead.id } })}
            />
          ))}
        </Stack>
      )}
    </ScrollView>
  );
}

/** Title, the signed-in staff member, and sign-out (clears the token and cached data). */
function WorkspaceHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const signOut = (): void => {
    setAccessToken(null);
    queryClient.clear();
    router.replace("/sign-in");
  };
  return (
    <Row gap={2} justify="between" align="start">
      <Stack gap={0}>
        <Text variant="title">Leads</Text>
        {me.data ? <Text tone="muted">{`Signed in as ${me.data.principal.name}`}</Text> : null}
      </Stack>
      <Button variant="ghost" size="sm" onPress={signOut}>
        Sign out
      </Button>
    </Row>
  );
}

function LeadRow({ lead, onPress }: { readonly lead: LeadView; readonly onPress: () => void }) {
  const summary = [
    lead.status.replace(/_/g, " "),
    lead.requestedDemo ? "demo requested" : null,
    lead.duplicateOfLeadId ? "possible duplicate" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Card onPress={onPress} accessibilityLabel={`Lead from ${lead.name}: ${summary}`}>
      <Stack gap={1}>
        <Row gap={2} justify="between">
          <Text variant="subheading" numberOfLines={1} className="flex-1">
            {lead.name}
          </Text>
          <StatusChip label={lead.status.replace(/_/g, " ")} tone="info" size="sm" />
        </Row>
        <Text tone="muted" numberOfLines={1}>
          {lead.email ?? lead.phone ?? "No contact"}
        </Text>
        <Row gap={2} wrap>
          <Text variant="caption" tone="muted">
            {lead.source.name}
          </Text>
          {lead.requestedDemo ? <StatusChip label="Demo requested" tone="brand" size="sm" /> : null}
          {lead.duplicateOfLeadId ? (
            <StatusChip label="Possible duplicate" tone="warning" size="sm" />
          ) : null}
        </Row>
      </Stack>
    </Card>
  );
}

function LeadsLoading() {
  return (
    <Stack gap={2} testID="leads-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

function LeadsError({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to view leads"
        description="Your session has ended. Sign in again to continue."
        action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  return <ErrorState onRetry={onRetry} />;
}
