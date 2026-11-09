import { useMemo, useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAuditEvents, useAuditExport } from "@ampm/api-client";
import {
  auditAction,
  isoDateTimeFromDate,
  type AuditActionName,
  type AuditEventPage,
  type AuditEventView,
  type AuditExportQuery,
} from "@ampm/core";
import {
  Button,
  Card,
  DataTable,
  DateRangeField,
  EmptyState,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Select,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
  type DataTableColumn,
  type DateRange,
  type SelectOption,
  type ToastOptions,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AuditEventDetailSheet } from "./audit-event-detail-sheet";
import { auditCsv } from "./audit-log.csv";
import {
  auditActionLabel,
  auditActionTone,
  auditActorLabel,
  auditEventSummary,
  formatMoment,
} from "./audit-log.format";
import { downloadCsv } from "./download-csv";

const COLUMNS: DataTableColumn<AuditEventView>[] = [
  {
    key: "when",
    header: "When",
    width: 170,
    render: (event) => <Text variant="data">{formatMoment(event.occurredAt)}</Text>,
  },
  {
    key: "action",
    header: "Action",
    width: 130,
    render: (event) => (
      <StatusChip
        label={auditActionLabel(event.action)}
        tone={auditActionTone(event.action)}
        size="sm"
      />
    ),
  },
  {
    key: "entity",
    header: "Entity",
    width: 170,
    render: (event) => (
      <Text variant="bodySmall" numberOfLines={1}>
        {event.entityType}
      </Text>
    ),
  },
  {
    key: "actor",
    header: "Actor",
    width: 110,
    render: (event) => <Text variant="bodySmall">{auditActorLabel(event.actorType)}</Text>,
  },
];

function auditEyebrow(page: AuditEventPage | undefined): string {
  if (!page) return "Admin console";
  return `Audit log · ${page.items.length}${page.nextCursor ? "+" : ""}`;
}

type ActionFilter = AuditActionName | "all";

const ACTION_OPTIONS: readonly SelectOption<ActionFilter>[] = [
  { value: "all", label: "All actions" },
  ...auditAction.options.map((action) => ({ value: action, label: auditActionLabel(action) })),
];

/** The event/export filters for the chosen range and action; the `to` bound covers the end day. */
function auditFilters(range: DateRange, action: AuditActionName | undefined): AuditExportQuery {
  return {
    from: range.from ? isoDateTimeFromDate(range.from) : undefined,
    to: range.to ? `${range.to}T23:59:59.999Z` : undefined,
    action,
  };
}

/** The toast after an export attempt: saved (with a truncation note), web-only, or the error path. */
function exportToast(saved: boolean, rowCount: number, truncated: boolean): ToastOptions {
  if (!saved) return { title: "Export from the web workspace", tone: "info" };
  const title = truncated ? `Exported the first ${rowCount} events` : `Exported ${rowCount} events`;
  return { title, tone: "success" };
}

function AuditLoading() {
  return (
    <Stack gap={2} testID="audit-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly events: UseQueryResult<AuditEventPage>;
  readonly onOpen: (event: AuditEventView) => void;
}

function AuditBody({ events, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (events.isPending) return <AuditLoading />;
  if (events.isError) {
    return (
      <QueryErrorState
        error={events.error}
        onRetry={() => void events.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view the audit log",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (events.data.items.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="No audit events yet"
        description="Changes to records appear here as they happen."
      />
    );
  }
  return (
    <Card padding="sm" testID="audit-table">
      <DataTable
        columns={COLUMNS}
        rows={events.data.items}
        keyExtractor={(event) => event.id}
        onRowPress={onOpen}
        rowAccessibilityLabel={auditEventSummary}
      />
    </Card>
  );
}

export interface AuditLogScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The audit log (TW-96): the append-only history of every change, newest first, in a table — tap a
 * row for the full record with its before/after images; filter by date range and action, and export
 * the filtered set to CSV. Super Admin only. Actor and entity filters are a later refinement.
 *
 *   <AuditLogScreen tabBar={<AppTabBar />} />
 */
export function AuditLogScreen({ tabBar }: AuditLogScreenProps) {
  const toast = useToast();
  const [range, setRange] = useState<DateRange>({});
  const [action, setAction] = useState<AuditActionName | undefined>(undefined);
  const filters = useMemo(() => auditFilters(range, action), [range, action]);
  const events = useAuditEvents(filters);
  const auditExport = useAuditExport();
  const [selected, setSelected] = useState<AuditEventView | null>(null);
  const runExport = (): void => {
    if (auditExport.isPending) return;
    auditExport.mutate(filters, {
      onSuccess: (snapshot) => {
        const saved = downloadCsv("audit-log.csv", auditCsv(snapshot.rows));
        toast.show(exportToast(saved, snapshot.rowCount, snapshot.truncated));
      },
      onError: () => toast.show({ title: "Could not export the audit log", tone: "danger" }),
    });
  };
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<ScreenHeader eyebrow={auditEyebrow(events.data)} title="Audit log" />}
    >
      <Stack gap={3}>
        <Row gap={2} wrap>
          <DateRangeField
            label="Date range"
            value={range}
            onChange={setRange}
            testID="audit-range"
            className="min-w-0 flex-1"
          />
          <Select
            label="Action"
            value={action ?? "all"}
            options={ACTION_OPTIONS}
            onChange={(next) => setAction(next === "all" ? undefined : next)}
            testID="audit-action"
            className="min-w-0 flex-1"
          />
        </Row>
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          loading={auditExport.isPending}
          onPress={runExport}
          testID="audit-export"
        >
          Export CSV
        </Button>
        <AuditBody events={events} onOpen={setSelected} />
      </Stack>
      <AuditEventDetailSheet event={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
