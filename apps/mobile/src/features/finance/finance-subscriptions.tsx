import type { CursorListResult } from "@ampm/api-client";
import type { SubscriptionReportRow } from "@ampm/core";
import {
  Card,
  DataTable,
  EmptyState,
  LoadMore,
  QueryErrorState,
  SegmentedControl,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { financeColumns } from "./finance-columns";
import {
  FINANCE_TABS,
  financeEmptyCopy,
  isFinanceTab,
  reportRowSummary,
  type FinanceTab,
} from "./finance.format";

export interface FinanceSubscriptionsProps {
  readonly tab: FinanceTab;
  readonly onTab: (tab: FinanceTab) => void;
  readonly report: CursorListResult<SubscriptionReportRow>;
  /** The awaiting subscription the header's Record payment acts on; none outside that tab. */
  readonly selectedId: string | undefined;
  /** Picks an awaiting subscription; absent where a row is not something to record against. */
  readonly onSelect: ((subscriptionId: string) => void) | undefined;
}

type BodyProps = Omit<FinanceSubscriptionsProps, "onTab">;

function ReportLoading() {
  return (
    <Stack gap={2} testID="finance-loading">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </Stack>
  );
}

/** The loaded rows and the next-page footer. */
function ReportTable({ tab, report, selectedId, onSelect }: BodyProps) {
  return (
    <Stack gap={4}>
      <DataTable
        columns={financeColumns(tab)}
        rows={report.items}
        keyExtractor={(row) => row.subscriptionId}
        onRowPress={onSelect ? (row) => onSelect(row.subscriptionId) : undefined}
        rowAccessibilityLabel={reportRowSummary}
        selectedKey={selectedId}
        testID="finance-table"
      />
      <LoadMore
        hasMore={report.hasMore}
        loading={report.isLoadingMore}
        failed={report.loadMoreError}
        onLoadMore={report.loadMore}
        testID="finance-load-more"
      />
    </Stack>
  );
}

function ReportBody(props: BodyProps) {
  const goToSignIn = useGoToSignIn();
  const { tab, report } = props;
  if (report.isPending) return <ReportLoading />;
  if (report.isError) {
    return (
      <QueryErrorState
        error={report.error}
        onRetry={report.refetch}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view subscriptions" }}
      />
    );
  }
  if (report.items.length === 0) {
    return <EmptyState icon="receipt" {...financeEmptyCopy(tab)} testID="finance-empty" />;
  }
  return <ReportTable {...props} />;
}

/**
 * T11's main panel, on Phase 1's data: the subscription report as a table in one glass card, under
 * underline tabs (Awaiting payment · Active · All). On the awaiting tab a row picks the subscription
 * the header's Record payment acts on. The table stacks into blocks below 768, as every table does.
 */
export function FinanceSubscriptions({ onTab, ...body }: FinanceSubscriptionsProps) {
  return (
    <Card padding="sm" testID="finance-subscriptions">
      <Stack gap={3}>
        <SegmentedControl
          variant="underline"
          accessibilityLabel="Subscriptions to show"
          options={FINANCE_TABS}
          value={body.tab}
          onChange={(next) => {
            if (isFinanceTab(next)) onTab(next);
          }}
          testID="finance-tabs"
        />
        <ReportBody {...body} />
      </Stack>
    </Card>
  );
}
