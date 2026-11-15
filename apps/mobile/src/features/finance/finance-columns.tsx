import { clientAmount, type SubscriptionReportRow } from "@ampm/core";
import { MoneyText, Stack, StatusChip, Text, type DataTableColumn } from "@ampm/ui";

import { subscriptionStatusLabel, subscriptionStatusTone } from "../accounts/accounts.format";
import { financeDay, lastAttemptLabel, type FinanceTab } from "./finance.format";

type Column = DataTableColumn<SubscriptionReportRow>;

/** The account, and the plan under it: the row's lead, which a phone's stacked row opens with. */
const ACCOUNT: Column = {
  key: "account",
  header: "Account",
  width: 180,
  grow: true,
  render: (row) => (
    <Stack gap={1}>
      <Text variant="body" weight="semibold" numberOfLines={1}>
        {row.accountName}
      </Text>
      <Text variant="bodySmall" tone="muted" numberOfLines={1}>
        {row.planName}
      </Text>
    </Stack>
  ),
};

const STATUS: Column = {
  key: "status",
  header: "Status",
  width: 120,
  render: (row) => (
    <StatusChip
      label={subscriptionStatusLabel(row.status)}
      tone={subscriptionStatusTone(row.status)}
      size="sm"
    />
  ),
};

const LAST_ATTEMPT: Column = {
  key: "last-payment",
  header: "Last payment",
  width: 150,
  render: (row) => (
    <Text variant="bodySmall" tone="body" numberOfLines={1}>
      {lastAttemptLabel(row)}
    </Text>
  ),
};

/** A day column: the value, or a dash when the subscription has none yet. */
function dayColumn(
  key: string,
  header: string,
  width: number,
  day: (row: SubscriptionReportRow) => string | null,
) {
  return {
    key,
    header,
    width,
    render: (row: SubscriptionReportRow) => {
      const iso = day(row);
      return (
        <Text variant="data" tone="body">
          {iso ? financeDay(iso) : "—"}
        </Text>
      );
    },
  } satisfies Column;
}

/** The plan's price: the sum a manual payment records, a client-facing amount. */
const AMOUNT: Column = {
  key: "amount",
  header: "Amount",
  width: 110,
  align: "end",
  render: (row) => <MoneyText amount={clientAmount(row.amount.minor)} variant="data" />,
};

const WAITING_SINCE = dayColumn("waiting", "Waiting since", 130, (row) => row.createdAt);
const STARTED = dayColumn("started", "Started", 110, (row) => row.startsAt);
const ENDS = dayColumn("ends", "Ends", 110, (row) => row.endsAt);

// Each tab's widths add up to at most 570, inside the card at 768 beside the collapsed rail (where the
// payments panel sits below the table); from 1024 the Account column takes the spare width.
const COLUMNS: Record<FinanceTab, readonly Column[]> = {
  awaiting: [ACCOUNT, LAST_ATTEMPT, WAITING_SINCE, AMOUNT],
  active: [ACCOUNT, STARTED, ENDS, AMOUNT],
  all: [ACCOUNT, STATUS, STARTED, AMOUNT],
};

/** The report table's columns for a tab: what Finance needs to act on that view. */
export function financeColumns(tab: FinanceTab): readonly Column[] {
  return COLUMNS[tab];
}
