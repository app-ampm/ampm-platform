import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConvertLead, useLead, useLeadActivities } from "@ampm/api-client";
import { isAppError, type LeadActivityView, type LeadView } from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

/** One lead: its details, the convert-to-client action, and its activity timeline. */
export function LeadDetailScreen({ leadId }: { readonly leadId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lead = useLead(leadId);
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Row justify="start">
        <Button variant="ghost" size="sm" icon="arrow-left" onPress={() => router.back()}>
          Back
        </Button>
      </Row>
      {lead.isPending ? (
        <DetailLoading />
      ) : lead.isError ? (
        <DetailError error={lead.error} onRetry={() => void lead.refetch()} />
      ) : (
        <LeadDetailBody lead={lead.data} />
      )}
    </ScrollView>
  );
}

function LeadDetailBody({ lead }: { readonly lead: LeadView }) {
  return (
    <Stack gap={4}>
      <Row gap={2} justify="between" align="start">
        <Text variant="title" numberOfLines={2} className="flex-1">
          {lead.name}
        </Text>
        <StatusChip label={lead.status.replace(/_/g, " ")} tone="info" />
      </Row>
      <Card>
        <Stack gap={3}>
          <FieldRow label="Email" value={lead.email ?? "—"} />
          <FieldRow label="Phone" value={lead.phone ?? "—"} />
          <FieldRow label="Source" value={lead.source.name} />
          <FieldRow
            label="Guest estimate"
            value={lead.guestEstimate === null ? "—" : String(lead.guestEstimate)}
          />
          <FieldRow label="Requirements" value={lead.requirements ?? "—"} />
          <FieldRow label="Marketing consent" value={lead.consentMarketing ? "Yes" : "No"} />
          <FieldRow label="Demo requested" value={lead.requestedDemo ? "Yes" : "No"} />
        </Stack>
      </Card>
      <ConvertCard lead={lead} />
      <LeadActivities leadId={lead.id} />
    </Stack>
  );
}

function FieldRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Row gap={2} justify="between" align="start">
      <Text tone="muted">{label}</Text>
      <Text className="flex-1 text-right" numberOfLines={3}>
        {value}
      </Text>
    </Row>
  );
}

/** The convert action: creates a client account and queues the portal invite, or explains why not. */
function ConvertCard({ lead }: { readonly lead: LeadView }) {
  const toast = useToast();
  const convert = useConvertLead(lead.id);

  if (lead.convertedAccountId)
    return <Callout kind="success" title="Converted to a client account" />;
  if (lead.status === "converted" || lead.status === "closed") {
    return <Callout kind="info" title={`This lead is ${lead.status}`} />;
  }
  if (!lead.email)
    return <Callout kind="warning" title="Add an email before converting this lead" />;

  const email = lead.email;
  const onConvert = (): void =>
    convert.mutate(
      { primaryContact: { email, isDecisionMaker: true } },
      {
        onSuccess: (result) =>
          toast.show({
            title: result.inviteQueued ? "Converted — invite sent" : "Converted — invite pending",
            tone: "success",
          }),
        onError: (error) =>
          toast.show({
            title:
              isAppError(error) && error.code === "conflict"
                ? "This lead was already converted"
                : "Could not convert the lead",
            tone: "danger",
          }),
      },
    );
  return (
    <Button fullWidth loading={convert.isPending} onPress={onConvert}>
      Convert to client
    </Button>
  );
}

function LeadActivities({ leadId }: { readonly leadId: string }) {
  const activities = useLeadActivities(leadId);
  // The timeline is secondary context; stay quiet while it loads or if it fails or is empty.
  if (activities.isPending || activities.isError || activities.data.items.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="label" tone="muted">
        Activity
      </Text>
      {activities.data.items.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} />
      ))}
    </Stack>
  );
}

function ActivityRow({ activity }: { readonly activity: LeadActivityView }) {
  return (
    <Card padding="sm">
      <Row gap={2} justify="between">
        <Text weight="medium">{activity.activityType.replace(/_/g, " ")}</Text>
        <Text variant="caption" tone="muted">
          {new Date(activity.occurredAt).toLocaleDateString()}
        </Text>
      </Row>
      {activity.summary ? <Text tone="muted">{activity.summary}</Text> : null}
    </Card>
  );
}

function DetailLoading() {
  return (
    <Stack gap={2} testID="lead-loading">
      <Skeleton shape="text" className="w-48" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}

function DetailError({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to view this lead"
        action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  if (isAppError(error) && error.code === "not_found") {
    return (
      <EmptyState icon="inbox" title="Lead not found" description="It may have been removed." />
    );
  }
  return <ErrorState onRetry={onRetry} />;
}
