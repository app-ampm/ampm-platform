import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useLeads } from "@ampm/api-client";
import type { LeadPage } from "@ampm/core";
import { EmptyState, Row, Screen, ScreenHeader, Skeleton, Stack, useBreakpoint } from "@ampm/ui";

import { LeadErrorState } from "./lead-error-state";
import { LeadsBoard } from "./leads-board";
import { LeadsList } from "./leads-list";
import { isOpenLead } from "./sales.format";

export interface LeadsListScreenProps {
  /** The app's tab bar (the route supplies it); the screen keeps room for it at the end. */
  readonly tabBar?: ReactNode;
}

/** "Leads and clients · 24 open", with a "+" while more pages wait beyond the loaded one. */
function pipelineEyebrow(page: LeadPage | undefined): string {
  if (!page) return "Leads and clients";
  const open = page.items.filter((lead) => isOpenLead(lead.status)).length;
  return `Leads and clients · ${open}${page.nextCursor ? "+" : ""} open`;
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
  readonly leads: UseQueryResult<LeadPage>;
  readonly isBoard: boolean;
  readonly onOpen: (leadId: string) => void;
}

function LeadsBody({ leads, isBoard, onOpen }: BodyProps) {
  if (leads.isPending) return <LeadsLoading isBoard={isBoard} />;
  if (leads.isError) {
    return (
      <LeadErrorState
        error={leads.error}
        onRetry={() => void leads.refetch()}
        signInTitle="Sign in to view leads"
        signInDescription="Your session has ended. Sign in again to continue."
      />
    );
  }
  if (leads.data.items.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="No enquiries yet"
        description="New enquiries from the website land here."
      />
    );
  }
  return isBoard ? (
    <LeadsBoard leads={leads.data.items} onOpen={onOpen} />
  ) : (
    <LeadsList leads={leads.data.items} onOpen={onOpen} />
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
  const isBoard = useBreakpoint().atLeast("md");
  const openLead = (id: string): void => router.push({ pathname: "/leads/[id]", params: { id } });
  return (
    <Screen
      tabBar={tabBar}
      header={<ScreenHeader eyebrow={pipelineEyebrow(leads.data)} title="Pipeline" />}
    >
      <LeadsBody leads={leads} isBoard={isBoard} onOpen={openLead} />
    </Screen>
  );
}
