import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useMe, useNotificationTemplates } from "@ampm/api-client";
import type { NotificationTemplates } from "@ampm/core";
import {
  Card,
  DataTable,
  EmptyState,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  Text,
  type DataTableColumn,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { rolesGrant } from "@/navigation/staff-areas";

import { AdminSectionNav } from "./admin-section-nav";
import { NotificationTemplateDetailSheet } from "./notification-template-detail-sheet";
import { NotificationTemplateEditSheet } from "./notification-template-edit-sheet";
import {
  notificationTemplateLabel,
  templateChannelsSummary,
  templateSummary,
  type TemplateEntry,
} from "./notification-templates.format";

/** The capability a Super Admin needs to edit templates; Finance may read them but not write. */
const CONFIG_UPDATE_PERMISSION = "admin.configurations.update";

/** The templates record as sorted, keyed rows for the table (stable order by template key). */
function toEntries(templates: NotificationTemplates): TemplateEntry[] {
  return Object.entries(templates)
    .map(([key, template]) => ({ key, template }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

const COLUMNS: DataTableColumn<TemplateEntry>[] = [
  {
    key: "template",
    header: "Template",
    width: 200,
    grow: true,
    render: (entry) => (
      <Text variant="bodySmall" numberOfLines={1}>
        {notificationTemplateLabel(entry.key)}
      </Text>
    ),
  },
  {
    key: "channels",
    header: "Channels",
    width: 180,
    render: (entry) => (
      <Text variant="bodySmall" tone="muted">
        {templateChannelsSummary(entry.template)}
      </Text>
    ),
  },
];

function templatesEyebrow(templates: NotificationTemplates | undefined): string {
  if (!templates) return "Admin console";
  return `Templates · ${Object.keys(templates).length}`;
}

function TemplatesLoading() {
  return (
    <Stack gap={2} testID="notification-templates-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly templates: UseQueryResult<NotificationTemplates>;
  readonly onOpen: (entry: TemplateEntry) => void;
}

function TemplatesBody({ templates, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (templates.isPending) return <TemplatesLoading />;
  if (templates.isError) {
    return (
      <QueryErrorState
        error={templates.error}
        onRetry={() => void templates.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view templates",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  const entries = toEntries(templates.data);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="No templates yet"
        description="The message templates the platform sends on each channel appear here."
      />
    );
  }
  return (
    <Card padding="sm" testID="notification-templates-table">
      <DataTable
        columns={COLUMNS}
        rows={entries}
        keyExtractor={(entry) => entry.key}
        onRowPress={onOpen}
        rowAccessibilityLabel={(entry) => templateSummary(entry.key, entry.template)}
      />
    </Card>
  );
}

export interface NotificationTemplatesScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The notification templates (TW-94): the per-channel message bodies the platform sends — email,
 * SMS, WhatsApp and push — one row per `templateKey`. Tap a row to read the full content and the
 * `{{variables}}` it fills; a Super Admin can edit it from there. The server is the gate — reads by
 * `admin.configurations.read` (Super Admin and Finance), edits by `admin.configurations.update` (Super
 * Admin). Finance sees no Edit action.
 *
 *   <NotificationTemplatesScreen tabBar={<AppTabBar />} />
 */
export function NotificationTemplatesScreen({ tabBar }: NotificationTemplatesScreenProps) {
  const templates = useNotificationTemplates();
  const me = useMe();
  const canEdit = me.data ? rolesGrant(me.data.roles, CONFIG_UPDATE_PERMISSION) : false;
  const [selected, setSelected] = useState<TemplateEntry | null>(null);
  const [editing, setEditing] = useState<TemplateEntry | null>(null);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={templatesEyebrow(templates.data)}
          title="Notification templates"
          actions={<AdminSectionNav current="notification-templates" />}
        />
      }
    >
      <TemplatesBody templates={templates} onOpen={setSelected} />
      <NotificationTemplateDetailSheet
        entry={selected}
        onClose={() => setSelected(null)}
        onEdit={
          canEdit && selected !== null
            ? () => {
                setEditing(selected);
                setSelected(null);
              }
            : undefined
        }
      />
      <NotificationTemplateEditSheet
        entry={editing}
        allTemplates={templates.data ?? {}}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}
