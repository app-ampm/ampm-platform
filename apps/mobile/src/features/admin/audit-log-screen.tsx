import { useMemo, useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAuditEvents } from "@ampm/api-client";
import {
  isoDateTimeFromDate,
  type AuditEventPage,
  type AuditEventQuery,
  type AuditEventView,
} from "@ampm/core";
import {
  Card,
  DataTable,
  DateRangeField,
  EmptyState,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  type DataTableColumn,
  type DateRange,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AuditEventDetailSheet } from "./audit-event-detail-sheet";
import {
  auditActionLabel,
  auditActionTone,
  auditActorLabel,
  auditEventSummary,
  formatMoment,
} from "./audit-log.format";

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

/** The event query for a chosen range: the `to` bound covers the whole end day (inclusive). */
function auditQuery(range: DateRange): Partial<AuditEventQuery> {
  return {
    from: range.from ? isoDateTimeFromDate(range.from) : undefined,
    to: range.to ? `${range.to}T23:59:59.999Z` : undefined,
  };
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
 * row for the full record with its before/after images, and filter by date range (the date-range
 * primitive). Super Admin only. Action/actor/entity filters (over the Select primitive) and export
 * are the next slice.
 *
 *   <AuditLogScreen tabBar={<AppTabBar />} />
 */
export function AuditLogScreen({ tabBar }: AuditLogScreenProps) {
  const [range, setRange] = useState<DateRange>({});
  const events = useAuditEvents(useMemo(() => auditQuery(range), [range]));
  const [selected, setSelected] = useState<AuditEventView | null>(null);
  return (
    <Screen
      tabBar={tabBar}
      header={<ScreenHeader eyebrow={auditEyebrow(events.data)} title="Audit log" />}
    >
      <Stack gap={3}>
        <DateRangeField label="Date range" value={range} onChange={setRange} testID="audit-range" />
        <AuditBody events={events} onOpen={setSelected} />
      </Stack>
      <AuditEventDetailSheet event={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
