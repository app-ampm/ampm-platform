import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useLeadFunnel, useMe } from "@ampm/api-client";
import type { LeadFunnelView, MeResponse } from "@ampm/core";
import {
  Card,
  ProgressBar,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Skeleton,
  Stack,
  Stat,
  Text,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { rolesGrant } from "@/navigation/staff-areas";

import {
  FUNNEL_WINDOWS,
  funnelRange,
  funnelWindowLabel,
  sourceBars,
  statusBars,
  type FunnelWindow,
} from "./lead-funnel";
import { statusLabel } from "./sales.format";

const FUNNEL_PERMISSION = "reports.lead_source_conversion_funnel.read";

interface Bar {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly fraction: number;
}

/** A labelled section of bars (by stage or by source), each bar its share of the busiest row. */
function BarSection({
  title,
  bars,
  testID,
}: {
  readonly title: string;
  readonly bars: readonly Bar[];
  readonly testID: string;
}) {
  return (
    <Stack gap={3} testID={testID}>
      <Text variant="heading">{title}</Text>
      <Card padding="sm">
        <Stack gap={4}>
          {bars.map((bar) => (
            <Stack key={bar.key} gap={1}>
              <Row gap={2} align="center" justify="between">
                <Text variant="bodySmall">{bar.label}</Text>
                <Text variant="bodySmall" tone="muted">
                  {String(bar.count)}
                </Text>
              </Row>
              <ProgressBar value={bar.fraction} label={`${bar.label}: ${bar.count}`} />
            </Stack>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

/** The loaded report: the total, then leads by stage (funnel order) and by source (busiest first). */
function FunnelReport({ view }: { readonly view: LeadFunnelView }) {
  if (view.total === 0) {
    return (
      <Text variant="body" tone="muted" testID="funnel-empty">
        No leads in this window yet.
      </Text>
    );
  }
  const stages: Bar[] = statusBars(view).map((bar) => ({
    key: bar.status,
    label: statusLabel(bar.status),
    count: bar.count,
    fraction: bar.fraction,
  }));
  const sources: Bar[] = sourceBars(view).map((bar) => ({
    key: bar.sourceKey,
    label: bar.name,
    count: bar.count,
    fraction: bar.fraction,
  }));
  return (
    <Stack gap={6}>
      <Stat label="Leads in range" value={view.total} testID="funnel-total" />
      <BarSection title="By stage" bars={stages} testID="funnel-by-stage" />
      {sources.length > 0 ? (
        <BarSection title="By source" bars={sources} testID="funnel-by-source" />
      ) : null}
    </Stack>
  );
}

function FunnelBody({
  me,
  canRun,
  funnel,
}: {
  readonly me: UseQueryResult<MeResponse>;
  readonly canRun: boolean;
  readonly funnel: UseQueryResult<LeadFunnelView>;
}) {
  const goToSignIn = useGoToSignIn();
  if (me.isPending) return <Skeleton className="h-64 w-full" testID="funnel-loading" />;
  // A failed /me (an expired session or no network) is a recoverable auth/infra error, not a denial:
  // without it the role is unknown, so offer sign-in/retry rather than telling a real SA/SM they lack access.
  if (me.isError) {
    return (
      <QueryErrorState
        error={me.error}
        onRetry={() => void me.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view the funnel" }}
      />
    );
  }
  if (!canRun) {
    return (
      <Text variant="body" tone="muted" testID="funnel-forbidden">
        The lead funnel is available to Sales and the Super Admin.
      </Text>
    );
  }
  if (funnel.isPending) return <Skeleton className="h-64 w-full" testID="funnel-loading" />;
  if (funnel.isError) {
    return (
      <QueryErrorState
        error={funnel.error}
        onRetry={() => void funnel.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view the funnel" }}
        forbidden={{
          title: "Not available",
          description: "This report is for Sales and the Super Admin.",
        }}
      />
    );
  }
  return <FunnelReport view={funnel.data} />;
}

/**
 * The lead-source conversion funnel (TW-83, AC-01.7): counts by stage and by source over a date window.
 * Only Sales and the Super Admin hold the report key, so the Hotel team, who may read leads, cannot run it.
 *
 *   <LeadFunnelScreen tabBar={<AppTabBar />} />
 */
export function LeadFunnelScreen({ tabBar }: { readonly tabBar?: ReactNode }) {
  const router = useRouter();
  const me = useMe();
  const canRun = me.data ? rolesGrant(me.data.roles, FUNNEL_PERMISSION) : false;
  const [window, setWindow] = useState<FunnelWindow>("all");
  const range = useMemo(() => funnelRange(window, Date.now()), [window]);
  const funnel = useLeadFunnel(range, { enabled: canRun });
  return (
    <Screen
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow="Leads and clients"
          title="Lead funnel"
          onBack={() => router.back()}
        />
      }
    >
      <Stack gap={6}>
        <SegmentedControl
          options={FUNNEL_WINDOWS.map((option) => ({
            value: option,
            label: funnelWindowLabel(option),
          }))}
          value={window}
          onChange={(value) => {
            const next = FUNNEL_WINDOWS.find((option) => option === value);
            if (next) setWindow(next);
          }}
          accessibilityLabel="Funnel date window"
          testID="funnel-window"
        />
        <FunnelBody me={me} canRun={canRun} funnel={funnel} />
      </Stack>
    </Screen>
  );
}
