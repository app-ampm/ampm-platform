import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { useLeads, useMe, type CursorListResult } from "@ampm/api-client";
import type { LeadView } from "@ampm/core";
import {
  EmptyState,
  FilterChip,
  LoadMore,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { rolesGrant } from "@/navigation/staff-areas";

import { LeadsBoard } from "./leads-board";
import { LeadsList } from "./leads-list";
import { PipelineActions, type PipelineView } from "./pipeline-actions";
import { isOpenLead, isShownLead } from "./sales.format";

/** The lead-funnel report key (§5.16): Sales and the Super Admin only, so the Funnel link is theirs. */
const FUNNEL_PERMISSION = "reports.lead_source_conversion_funnel.read";

/** What the body shows: the list on a phone, or from 768 the view picked in the header. */
type PipelineLayout = "phone" | PipelineView;

export interface LeadsListScreenProps {
  /** The app's tab bar (the route supplies it); the screen keeps room for it at the end. */
  readonly tabBar?: ReactNode;
}

/** "Leads and clients · 24 open", with a "+" while more pages wait beyond the loaded ones. */
function pipelineEyebrow(leads: CursorListResult<LeadView>): string {
  if (leads.isPending) return "Leads and clients";
  const open = leads.items.filter((lead) => isOpenLead(lead.status)).length;
  return `Leads and clients · ${open}${leads.hasMore ? "+" : ""} open`;
}

/** Skeletons in the shape the leads will take: columns sharing the board, or rows. */
function LeadsLoading({ isBoard }: { readonly isBoard: boolean }) {
  if (isBoard) {
    return (
      <Row gap={2.5} align="start" className="overflow-hidden" testID="leads-loading">
        <Skeleton className="h-72 min-w-36 flex-1" />
        <Skeleton className="h-56 min-w-36 flex-1" />
        <Skeleton className="h-64 min-w-36 flex-1" />
        <Skeleton className="h-56 min-w-36 flex-1" />
      </Row>
    );
  }
  return (
    <Stack gap={2} testID="leads-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

interface ClosedFilterProps {
  readonly leads: readonly LeadView[];
  readonly selected: boolean;
  readonly onToggle: () => void;
}

/**
 * The chip row under the header (T2): "Closed · n" brings the closed (lost) leads back, as the board's
 * last column and in the list. The count is of the loaded leads; the check says it is on, not colour alone.
 */
function ClosedFilter({ leads, selected, onToggle }: ClosedFilterProps) {
  const closed = leads.filter((lead) => lead.status === "closed").length;
  return (
    <Row gap={2} wrap testID="leads-filters">
      <FilterChip
        label="Closed"
        count={closed}
        selected={selected}
        icon={selected ? "check" : undefined}
        onPress={onToggle}
        testID="leads-closed-filter"
      />
    </Row>
  );
}

interface PipelineLeadsProps {
  readonly leads: readonly LeadView[];
  readonly layout: PipelineLayout;
  readonly showClosed: boolean;
  readonly onOpen: (leadId: string) => void;
}

/** The leads as the layout asks: the board, or the list (every lead on a phone, as before). */
function PipelineLeads({ leads, layout, showClosed, onOpen }: PipelineLeadsProps) {
  if (layout === "board") {
    return <LeadsBoard leads={leads} showClosed={showClosed} onOpen={onOpen} />;
  }
  const shown = layout === "phone" ? leads : leads.filter((lead) => isShownLead(lead, showClosed));
  if (shown.length === 0) {
    return (
      <Text variant="bodySmall" tone="muted" testID="leads-all-closed">
        Every loaded lead is closed. Turn on Closed to see them.
      </Text>
    );
  }
  return <LeadsList leads={shown} onOpen={onOpen} />;
}

interface BodyProps {
  readonly leads: CursorListResult<LeadView>;
  readonly layout: PipelineLayout;
  readonly showClosed: boolean;
  readonly onToggleClosed: () => void;
  readonly onOpen: (leadId: string) => void;
}

/** The loaded pipeline: the chip row from 768 (a fixed slot, empty on a phone), the leads, Load more. */
function LeadsLoaded({ leads, layout, showClosed, onToggleClosed, onOpen }: BodyProps) {
  return (
    <Stack gap={4}>
      {layout === "phone" ? null : (
        <ClosedFilter leads={leads.items} selected={showClosed} onToggle={onToggleClosed} />
      )}
      <PipelineLeads leads={leads.items} layout={layout} showClosed={showClosed} onOpen={onOpen} />
      <LoadMore
        hasMore={leads.hasMore}
        loading={leads.isLoadingMore}
        failed={leads.loadMoreError}
        onLoadMore={leads.loadMore}
        testID="leads-load-more"
      />
    </Stack>
  );
}

function LeadsBody(props: BodyProps) {
  const { leads, layout } = props;
  const goToSignIn = useGoToSignIn();
  if (leads.isPending) return <LeadsLoading isBoard={layout === "board"} />;
  if (leads.isError) {
    return (
      <QueryErrorState
        error={leads.error}
        onRetry={leads.refetch}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view leads",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (leads.items.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="No enquiries yet"
        description="New enquiries from the website land here."
      />
    );
  }
  return <LeadsLoaded {...props} />;
}

/**
 * The Sales pipeline (T2, TW-10): incoming enquiries (the first page, newest first). From 768 the header
 * switches between the board of stages and the list, and a chip brings back the closed leads; a phone
 * reads the list. The view and the chip live here, above every width, so a window crossing 768 or 1024
 * keeps them. Each lead opens its detail; navigation lives in the app's rail, tab bar and More screen.
 *
 *   <LeadsListScreen tabBar={<AppTabBar />} />
 */
export function LeadsListScreen({ tabBar }: LeadsListScreenProps) {
  const router = useRouter();
  const leads = useLeads();
  const me = useMe();
  const canSwitch = useLayoutAt("md");
  const [view, setView] = useState<PipelineView>("board");
  const [showClosed, setShowClosed] = useState(false);
  const canRunFunnel = me.data ? rolesGrant(me.data.roles, FUNNEL_PERMISSION) : false;
  const openLead = (id: string): void => router.push({ pathname: "/leads/[id]", params: { id } });
  const header = (
    <ScreenHeader
      eyebrow={pipelineEyebrow(leads)}
      title="Pipeline"
      actions={
        <PipelineActions
          view={canSwitch ? view : null}
          onView={setView}
          canRunFunnel={canRunFunnel}
        />
      }
    />
  );
  return (
    <Screen width="wide" tabBar={tabBar} header={header}>
      <LeadsBody
        leads={leads}
        layout={canSwitch ? view : "phone"}
        showClosed={showClosed}
        onToggleClosed={() => setShowClosed((shown) => !shown)}
        onOpen={openLead}
      />
    </Screen>
  );
}
