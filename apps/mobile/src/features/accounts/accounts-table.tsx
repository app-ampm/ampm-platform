import type { AccountView } from "@ampm/core";
import { Card, DataTable, Stack, StatusChip, Text, type DataTableColumn } from "@ampm/ui";

import {
  accountDay,
  accountRowSummary,
  accountStatusLabel,
  accountStatusTone,
} from "./accounts.format";

// The widths add up to 580, inside the card's 591 at 768 beside the collapsed rail, so a tablet shows
// the whole table without scrolling it sideways; from 1024 the Client column takes the spare width.
const COLUMNS: DataTableColumn<AccountView>[] = [
  {
    key: "client",
    header: "Client",
    width: 200,
    grow: true,
    render: (account) => (
      <Stack gap={1}>
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {account.name}
        </Text>
        {account.coupleNames ? (
          <Text variant="bodySmall" tone="muted" numberOfLines={1}>
            {account.coupleNames}
          </Text>
        ) : null}
      </Stack>
    ),
  },
  {
    key: "locations",
    header: "Locations",
    width: 160,
    render: (account) => (
      <Text variant="bodySmall" tone="body" numberOfLines={1}>
        {account.preferredLocations ?? "—"}
      </Text>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: 110,
    render: (account) => (
      <StatusChip
        label={accountStatusLabel(account.status)}
        tone={accountStatusTone(account.status)}
        size="sm"
      />
    ),
  },
  {
    key: "added",
    header: "Added",
    width: 110,
    align: "end",
    render: (account) => (
      <Text variant="data" tone="body">
        {accountDay(account.createdAt)}
      </Text>
    ),
  },
];

export interface AccountsTableProps {
  /** The loaded client accounts, newest first. */
  readonly accounts: readonly AccountView[];
  readonly onOpen: (accountId: string) => void;
}

/**
 * The client accounts as a table in one glass card, from 768 (the T4 table pattern): the account and
 * its couple, the preferred locations, the status and the day it was added. A row opens the account.
 * Phones keep `AccountsList`'s rows, since a table this wide runs off a phone's edge.
 */
export function AccountsTable({ accounts, onOpen }: AccountsTableProps) {
  return (
    <Card padding="sm" testID="accounts-table">
      <DataTable
        columns={COLUMNS}
        rows={accounts}
        keyExtractor={(account) => account.id}
        onRowPress={(account) => onOpen(account.id)}
        rowAccessibilityLabel={(account) => accountRowSummary(account.name, account.status)}
      />
    </Card>
  );
}
