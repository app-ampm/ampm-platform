import { useState } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useLead } from "@ampm/api-client";
import type { LeadView } from "@ampm/core";
import {
  Button,
  Columns,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { LeadActivityCard } from "./lead-activity-card";
import { LeadActivitySheet } from "./lead-activity-sheet";
import { LeadAdvanceButton } from "./lead-advance-button";
import { LeadContactCard } from "./lead-contact-card";
import { LeadDemoCard } from "./lead-demo-card";
import { LeadInviteCard } from "./lead-invite-card";
import { LeadManageCard } from "./lead-manage-card";
import { isOpenLead, leadFacts, statusLabel, statusTone } from "./sales.format";

interface LeadHeaderProps {
  /** The lead once it has loaded; until then the header holds the back button and a plain title. */
  readonly lead: LeadView | undefined;
  readonly onBack: () => void;
  readonly onLog: () => void;
}

/**
 * T3's record header on its own glass: the name with its stage, the facts line, and the working actions
 * of an open lead. Both actions are glass: the invitation's send button is the page's one gold action.
 */
function LeadHeader({ lead, onBack, onLog }: LeadHeaderProps) {
  const actions =
    lead && isOpenLead(lead.status) ? (
      <>
        <Button variant="glass" icon="plus" onPress={onLog} testID="lead-activity-add">
          Log activity
        </Button>
        <LeadAdvanceButton lead={lead} />
      </>
    ) : undefined;
  return (
    <ScreenHeader
      variant="panel"
      onBack={onBack}
      title={lead?.name ?? "Lead"}
      badge={
        lead ? (
          <StatusChip label={statusLabel(lead.status)} tone={statusTone(lead.status)} />
        ) : undefined
      }
      subtitle={lead ? leadFacts(lead) : undefined}
      actions={actions}
      testID="lead-header"
    />
  );
}

/**
 * T3's columns at 1.3 : 1 from 1024: the activity on the left, filling the row's height, beside demo
 * access, the invitation, the working actions and the contact. Below 1024 the side stack comes first, so
 * a phone reaches the gold invitation and Assign or Close before a long timeline. The two columns are
 * keyed and only swap places, so React moves them rather than remounting: an open sheet or a typed
 * reason in the manage card survives a resize.
 */
function LeadDetailBody({ lead }: { readonly lead: LeadView }) {
  const isDesktop = useLayoutAt("lg");
  const activity = (
    <LeadActivityCard
      key="activity"
      leadId={lead.id}
      className={isDesktop ? "flex-1" : undefined}
    />
  );
  const side = (
    <Stack key="side" gap={4.5} testID="lead-side">
      <LeadDemoCard lead={lead} />
      <LeadInviteCard lead={lead} />
      <LeadManageCard lead={lead} />
      <LeadContactCard lead={lead} />
    </Stack>
  );
  return (
    <Columns ratios={[1.3, 1]} testID="lead-columns">
      {isDesktop ? [activity, side] : [side, activity]}
    </Columns>
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
  const goToSignIn = useGoToSignIn();
  if (lead.isPending) return <DetailLoading />;
  if (lead.isError) {
    return (
      <QueryErrorState
        error={lead.error}
        onRetry={() => void lead.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view this lead" }}
        notFound={{ title: "Lead not found", description: "It may have been removed." }}
      />
    );
  }
  return <LeadDetailBody lead={lead.data} />;
}

/**
 * One lead (T3, TW-11): the record header (name, stage, facts, Log activity and Advance), then the
 * activity beside demo access, the invitation that converts it into a client account (the one gold
 * action), the working actions and the contact. The log-activity sheet is held here, above the layout,
 * so it and its draft survive a resize. T3's tab strip waits for the account, agreements and history.
 *
 *   <LeadDetailScreen leadId={id} />
 */
export function LeadDetailScreen({ leadId }: { readonly leadId: string }) {
  const router = useRouter();
  const lead = useLead(leadId);
  const [logging, setLogging] = useState(false);
  const header = (
    <LeadHeader lead={lead.data} onBack={() => router.back()} onLog={() => setLogging(true)} />
  );
  return (
    <Screen width="wide" header={header}>
      <DetailBody lead={lead} />
      <LeadActivitySheet leadId={logging ? leadId : null} onClose={() => setLogging(false)} />
    </Screen>
  );
}
