import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useMe, useSubscriptionReport, type CursorListResult } from "@ampm/api-client";
import type { MeResponse, SubscriptionReportRow } from "@ampm/core";
import { QueryErrorState, Screen, ScreenHeader, Skeleton, SplitPane, Text } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { rolesGrant } from "@/navigation/staff-areas";

import { RecordPaymentSheet } from "../accounts/record-payment-sheet";
import { useCanRecordPayment } from "../accounts/use-can-record-payment";
import { FinanceActions } from "./finance-actions";
import { FinancePayments } from "./finance-payments";
import { FinanceSubscriptions } from "./finance-subscriptions";
import { financeTabStatus, recordingSubject, type FinanceTab } from "./finance.format";
import { useReportExport } from "./use-report-export";

const REPORT_PERMISSION = "reports.subscription_status_payment_history.read";
const EXPORT_PERMISSION = "reports.subscription_status_payment_history.export";
const LEDGER_PERMISSION = "crm.payments.read";

/**
 * The awaiting subscription Record payment acts on: the one picked, while it is still in the queue,
 * else the oldest awaiting (the queue's first row). None on the other tabs.
 */
function selectedAwaiting(
  tab: FinanceTab,
  rows: readonly SubscriptionReportRow[],
  pickedId: string | undefined,
): SubscriptionReportRow | undefined {
  if (tab !== "awaiting") return undefined;
  return rows.find((row) => row.subscriptionId === pickedId) ?? rows[0];
}

interface BodyProps {
  readonly me: UseQueryResult<MeResponse>;
  readonly canRun: boolean;
  readonly canReadLedger: boolean;
  readonly tab: FinanceTab;
  readonly onTab: (tab: FinanceTab) => void;
  readonly report: CursorListResult<SubscriptionReportRow>;
  readonly selected: SubscriptionReportRow | undefined;
  readonly onSelect: (subscriptionId: string) => void;
}

function FinanceBody({ me, canRun, canReadLedger, tab, onSelect, selected, ...rest }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (me.isPending) return <Skeleton className="h-64 w-full" testID="finance-me-loading" />;
  // A failed /me is a session or network problem, not a refusal: offer sign-in and retry.
  if (me.isError) {
    return (
      <QueryErrorState
        error={me.error}
        onRetry={() => void me.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view Finance & Reports" }}
      />
    );
  }
  if (!canRun) {
    return (
      <Text variant="body" tone="muted" testID="finance-forbidden">
        {"Finance & Reports is for Finance, Sales and the Super Admin."}
      </Text>
    );
  }
  const subscriptions = (
    <FinanceSubscriptions
      {...rest}
      tab={tab}
      selectedId={selected?.subscriptionId}
      onSelect={tab === "awaiting" ? onSelect : undefined}
    />
  );
  // Sales runs the report but not the ledger: the panel is left out, not greyed out (W-5).
  if (!canReadLedger) return subscriptions;
  return (
    <SplitPane side={<FinancePayments />} sideWidth="md" gap={3.5} testID="finance-split">
      {subscriptions}
    </SplitPane>
  );
}

export interface FinanceScreenProps {
  readonly tabBar?: ReactNode;
}

/** The screen's state: the tab, the subscription picked in it, the report and the open record sheet. */
function useFinanceScreen() {
  const me = useMe();
  const roles = me.data?.roles ?? [];
  const canRun = me.data ? rolesGrant(roles, REPORT_PERMISSION) : false;
  const canReadLedger = me.data ? rolesGrant(roles, LEDGER_PERMISSION) : false;
  const canRecord = useCanRecordPayment();
  const [tab, setTab] = useState<FinanceTab>("awaiting");
  const [pickedId, setPickedId] = useState<string | undefined>(undefined);
  const [recording, setRecording] = useState<SubscriptionReportRow | null>(null);
  const report = useSubscriptionReport({ status: financeTabStatus(tab) }, { enabled: canRun });
  const selected = selectedAwaiting(tab, report.items, pickedId);
  const reportExport = useReportExport();
  const canExport = me.data ? rolesGrant(roles, EXPORT_PERMISSION) : false;
  return {
    body: {
      me,
      canRun,
      canReadLedger,
      tab,
      onTab: setTab,
      report,
      selected,
      onSelect: setPickedId,
    },
    actions: {
      canExport,
      exporting: reportExport.exporting,
      onExport: () => reportExport.run(tab, financeTabStatus(tab)),
      canRecord: canRun && canRecord && tab === "awaiting",
      selected,
      onRecord: setRecording,
    },
    recording,
    setRecording,
  };
}

/**
 * Finance & Reports (TW-80 on T11's frame, D-128): the subscription status report (§5.16) beside the
 * payments received. Finance, Sales and the Super Admin may run the report; only Finance and the Super
 * Admin read the ledger and export the report. Record payment opens the shared record sheet for the
 * awaiting subscription picked in the table, and appears to whoever may record one (D-125).
 *
 *   <FinanceScreen tabBar={<AppTabBar />} />
 */
export function FinanceScreen({ tabBar }: FinanceScreenProps) {
  const { body, actions, recording, setRecording } = useFinanceScreen();
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow="Finance & Reports"
          title="Subscriptions and payments"
          actions={<FinanceActions {...actions} />}
          testID="finance-header"
        />
      }
    >
      <FinanceBody {...body} />
      <RecordPaymentSheet
        subscriptionId={recording?.subscriptionId ?? null}
        subject={recording ? recordingSubject(recording) : undefined}
        onClose={() => setRecording(null)}
      />
    </Screen>
  );
}
