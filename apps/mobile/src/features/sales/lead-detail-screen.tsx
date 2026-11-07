import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useLead } from "@ampm/api-client";
import type { LeadView } from "@ampm/core";
import { Row, Screen, ScreenHeader, Skeleton, Stack, StatusChip, useBreakpoint } from "@ampm/ui";

import { LeadActivityCard } from "./lead-activity-card";
import { LeadDemoCard } from "./lead-demo-card";
import { LeadErrorState } from "./lead-error-state";
import { LeadFactsCard } from "./lead-facts-card";
import { LeadInviteCard } from "./lead-invite-card";
import { statusLabel, statusTone } from "./sales.format";

/**
 * A phone or tablet reads one column with the action early: facts, invite, demo, activity. From 1024
 * the two columns of T3: facts and activity on the left, demo and invite on the right.
 */
function LeadDetailBody({ lead }: { readonly lead: LeadView }) {
  const isWide = useBreakpoint().atLeast("lg");
  if (!isWide) {
    return (
      <Stack gap={4}>
        <LeadFactsCard lead={lead} />
        <LeadInviteCard lead={lead} />
        <LeadDemoCard lead={lead} />
        <LeadActivityCard leadId={lead.id} />
      </Stack>
    );
  }
  return (
    <Row gap={4.5} align="start">
      <Stack gap={4.5} className="flex-1">
        <LeadFactsCard lead={lead} />
        <LeadActivityCard leadId={lead.id} />
      </Stack>
      <Stack gap={4.5} className="w-96">
        <LeadDemoCard lead={lead} />
        <LeadInviteCard lead={lead} />
      </Stack>
    </Row>
  );
}

function DetailLoading() {
  return (
    <Stack gap={4} testID="lead-loading">
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}

function DetailBody({ lead }: { readonly lead: UseQueryResult<LeadView> }) {
  if (lead.isPending) return <DetailLoading />;
  if (lead.isError) {
    return (
      <LeadErrorState
        error={lead.error}
        onRetry={() => void lead.refetch()}
        signInTitle="Sign in to view this lead"
        notFound={{ title: "Lead not found", description: "It may have been removed." }}
      />
    );
  }
  return <LeadDetailBody lead={lead.data} />;
}

/**
 * One lead (T3, TW-11): the name in Gilda with its stage, the facts on glass, the invitation that
 * converts it into a client account (the one gold action), demo access and the activity timeline.
 *
 *   <LeadDetailScreen leadId={id} />
 */
export function LeadDetailScreen({ leadId }: { readonly leadId: string }) {
  const router = useRouter();
  const lead = useLead(leadId);
  const status = lead.data?.status;
  const header = (
    <ScreenHeader
      onBack={() => router.back()}
      eyebrow="Leads and clients"
      title={lead.data?.name ?? "Lead"}
      trailing={
        status ? <StatusChip label={statusLabel(status)} tone={statusTone(status)} /> : undefined
      }
    />
  );
  return (
    <Screen width="wide" header={header}>
      <DetailBody lead={lead} />
    </Screen>
  );
}
