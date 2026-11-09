import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useConfigurations, useMe } from "@ampm/api-client";
import type { ConfigView } from "@ampm/core";
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

import { isEditableConfigKey } from "./configuration.edit";
import { ConfigurationDetailSheet } from "./configuration-detail-sheet";
import { ConfigurationEditSheet } from "./configuration-edit-sheet";
import {
  configArea,
  configLabel,
  configRowSummary,
  configSummary,
  toConfigEntries,
  type ConfigEntry,
} from "./configuration.format";

/** The capability a Super Admin needs to edit configuration; Finance may read it but not write it. */
const CONFIG_UPDATE_PERMISSION = "admin.configurations.update";

const COLUMNS: DataTableColumn<ConfigEntry>[] = [
  {
    key: "setting",
    header: "Setting",
    width: 200,
    render: (entry) => (
      <Stack gap={1}>
        <Text variant="bodySmall" numberOfLines={1}>
          {configLabel(entry.key)}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {configArea(entry.key)}
        </Text>
      </Stack>
    ),
  },
  {
    key: "value",
    header: "Value",
    width: 240,
    render: (entry) => (
      <Text variant="bodySmall" tone="muted" numberOfLines={1}>
        {configSummary(entry.value)}
      </Text>
    ),
  },
];

function configEyebrow(data: ConfigView[] | undefined): string {
  if (!data) return "Admin console";
  return `Settings · ${toConfigEntries(data).length}`;
}

function ConfigurationLoading() {
  return (
    <Stack gap={2} testID="configuration-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly configurations: UseQueryResult<ConfigView[]>;
  readonly onOpen: (entry: ConfigEntry) => void;
}

function ConfigurationBody({ configurations, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (configurations.isPending) return <ConfigurationLoading />;
  if (configurations.isError) {
    return (
      <QueryErrorState
        error={configurations.error}
        onRetry={() => void configurations.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view configuration",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  const entries = toConfigEntries(configurations.data);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="No configuration"
        description="The platform's thresholds, policies and switches appear here."
      />
    );
  }
  return (
    <Card padding="sm" testID="configuration-table">
      <DataTable
        columns={COLUMNS}
        rows={entries}
        keyExtractor={(entry) => entry.key}
        onRowPress={onOpen}
        rowAccessibilityLabel={configRowSummary}
      />
    </Card>
  );
}

export interface ConfigurationScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The configuration inventory (Settings): every platform setting that is configuration, not code —
 * session timeouts, verification freshness, subscription and consultancy policy, feature switches —
 * one row per key with a one-line value. Tap a row to read the full value and what it controls; a Super
 * Admin can edit it from there. The server is the gate — reads by `admin.configurations.read` (Super
 * Admin and Finance), edits by `admin.configurations.update` (Super Admin). Finance sees no Edit action.
 * Notification templates keep their own screen.
 *
 *   <ConfigurationScreen tabBar={<AppTabBar />} />
 */
export function ConfigurationScreen({ tabBar }: ConfigurationScreenProps) {
  const configurations = useConfigurations();
  const me = useMe();
  const canEdit = me.data ? rolesGrant(me.data.roles, CONFIG_UPDATE_PERMISSION) : false;
  const [selected, setSelected] = useState<ConfigEntry | null>(null);
  const [editing, setEditing] = useState<ConfigEntry | null>(null);
  const canEditSelected = canEdit && selected !== null && isEditableConfigKey(selected.key);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<ScreenHeader eyebrow={configEyebrow(configurations.data)} title="Configuration" />}
    >
      <ConfigurationBody configurations={configurations} onOpen={setSelected} />
      <ConfigurationDetailSheet
        entry={selected}
        onClose={() => setSelected(null)}
        onEdit={
          canEditSelected
            ? () => {
                setEditing(selected);
                setSelected(null);
              }
            : undefined
        }
      />
      <ConfigurationEditSheet entry={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
