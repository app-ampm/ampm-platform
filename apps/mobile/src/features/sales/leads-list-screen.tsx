import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useLeads, useMe, type CursorListResult } from "@ampm/api-client";
import type { LeadView } from "@ampm/core";
import {
  Button,
  EmptyState,
  LoadMore,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  useBreakpoint,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { rolesGrant } from "@/navigation/staff-areas";

import { LeadsBoard } from "./leads-board";
import { LeadsList } from "./leads-list";
import { isOpenLead } from "./sales.format";

/** The lead-funnel report key (§5.16): Sales and the Super Admin only, so the Funnel link is theirs. */
const FUNNEL_PERMISSION = "reports.lead_source_conversion_funnel.read";

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

/** Skeletons in the shape the leads will take: three columns on the board, rows on a phone. */
function LeadsLoading({ isBoard }: { readonly isBoard: boolean }) {
  if (isBoard) {
    return (
      <Row gap={2.5} align="start" className="overflow-hidden" testID="leads-loading">
        <Skeleton className="h-72 w-56" />
        <Skeleton className="h-56 w-56" />
        <Skeleton className="h-64 w-56" />
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

interface BodyProps {
  readonly leads: CursorListResult<LeadView>;
  readonly isBoard: boolean;
  readonly onOpen: (leadId: string) => void;
}

function LeadsBody({ leads, isBoard, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (leads.isPending) return <LeadsLoading isBoard={isBoard} />;
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
  return (
    <Stack gap={4}>
      {isBoard ? (
        <LeadsBoard leads={leads.items} onOpen={onOpen} />
      ) : (
        <LeadsList leads={leads.items} onOpen={onOpen} />
      )}
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

/**
 * The Sales pipeline (T2, TW-10): incoming enquiries (the first page, newest first) as a board of
 * stages from 768 up and as a list of rows on a phone; each lead opens its detail. Navigation and
 * sign-out live in the app's rail, tab bar and More screen, not here.
 *
 *   <LeadsListScreen tabBar={<AppTabBar />} />
 */
export function LeadsListScreen({ tabBar }: LeadsListScreenProps) {
  const router = useRouter();
  const leads = useLeads();
  const me = useMe();
  const isBoard = useBreakpoint().atLeast("md");
  const canRunFunnel = me.data ? rolesGrant(me.data.roles, FUNNEL_PERMISSION) : false;
  const openLead = (id: string): void => router.push({ pathname: "/leads/[id]", params: { id } });
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={pipelineEyebrow(leads)}
          title="Pipeline"
          trailing={
            <Row gap={2}>
              {canRunFunnel ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="filter"
                  onPress={() => router.push("/leads/funnel")}
                  testID="leads-funnel-link"
                >
                  Funnel
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                icon="briefcase"
                onPress={() => router.push("/leads/accounts")}
                testID="leads-clients-link"
              >
                Clients
              </Button>
            </Row>
          }
        />
      }
    >
      <LeadsBody leads={leads} isBoard={isBoard} onOpen={openLead} />
    </Screen>
  );
}
