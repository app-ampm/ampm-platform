import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useLeadFunnel, useMe } from "@ampm/api-client";
import type { LeadFunnelView, MeResponse } from "@ampm/core";
import {
  Card,
  Columns,
  Grid,
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
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { rolesGrant } from "@/navigation/staff-areas";

import {
  FUNNEL_WINDOWS,
  funnelRange,
  funnelSummary,
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

interface BarSectionProps {
  readonly title: string;
  readonly bars: readonly Bar[];
  /** Side by side, both sections' cards reach the row's height. */
  readonly fill: boolean;
  readonly testID: string;
}

/** A labelled section of bars (by stage or by source), each bar its share of the busiest row. */
function BarSection({ title, bars, fill, testID }: BarSectionProps) {
  return (
    <Stack gap={3} className={fill ? "flex-1" : undefined} testID={testID}>
      <Text variant="heading">{title}</Text>
      <Card padding="sm" className={fill ? "flex-1" : undefined}>
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

/**
 * The leads in range as a glass KPI card in T1's pattern (eyebrow, numeral, caption): a quarter of the
 * row from 1024 as T1's cards are, half from 768, the full width on a phone.
 */
function FunnelTotal({ view }: { readonly view: LeadFunnelView }) {
  return (
    <Grid columns={{ md: 2, lg: 4 }}>
      <Card padding="none" className="px-5.5 py-5" testID="funnel-kpi">
        <Stat
          label="Leads in range"
          value={view.total}
          caption={funnelSummary(view)}
          testID="funnel-total"
        />
      </Card>
    </Grid>
  );
}

/**
 * The loaded report: the total, then leads by stage (funnel order) beside leads by source (busiest
 * first) from 1024, so no bar runs the whole width of a desktop; stacked below 1024.
 */
function FunnelReport({ view }: { readonly view: LeadFunnelView }) {
  const isDesktop = useLayoutAt("lg");
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
      <FunnelTotal view={view} />
      <Columns ratios={[1, 1]} gap={6} testID="funnel-columns">
        <BarSection title="By stage" bars={stages} fill={isDesktop} testID="funnel-by-stage" />
        {sources.length > 0 ? (
          <BarSection title="By source" bars={sources} fill={isDesktop} testID="funnel-by-source" />
        ) : null}
      </Columns>
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

/** The date window as a pill switch: in the header's actions, at its right from 768. */
function WindowSwitch({
  value,
  onChange,
}: {
  readonly value: FunnelWindow;
  readonly onChange: (window: FunnelWindow) => void;
}) {
  return (
    <SegmentedControl
      options={FUNNEL_WINDOWS.map((option) => ({
        value: option,
        label: funnelWindowLabel(option),
      }))}
      value={value}
      onChange={(next) => {
        const window = FUNNEL_WINDOWS.find((option) => option === next);
        if (window) onChange(window);
      }}
      accessibilityLabel="Funnel date window"
      testID="funnel-window"
    />
  );
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
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow="Leads and clients"
          title="Lead funnel"
          onBack={() => router.back()}
          actions={<WindowSwitch value={window} onChange={setWindow} />}
          testID="funnel-header"
        />
      }
    >
      <FunnelBody me={me} canRun={canRun} funnel={funnel} />
    </Screen>
  );
}
