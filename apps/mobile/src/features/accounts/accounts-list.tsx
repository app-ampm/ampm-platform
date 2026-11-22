import { coupleSubtitle, type AccountView } from "@ampm/core";
import { Card, ListItem, Stack, StatusChip } from "@ampm/ui";

import {
  accountCreatedLabel,
  accountRowSummary,
  accountStatusLabel,
  accountStatusTone,
} from "./accounts.format";

export interface AccountsListProps {
  /** The loaded client accounts, newest first. */
  readonly accounts: readonly AccountView[];
  readonly onOpen: (accountId: string) => void;
}

/**
 * The client accounts as a glass panel of rows: each shows the account, its couple names (unless the
 * account is already named after them) and when it was added, with a status chip, and opens the record.
 */
export function AccountsList({ accounts, onOpen }: AccountsListProps) {
  return (
    <Card padding="sm" testID="accounts-list">
      <Stack gap={2}>
        {accounts.map((account) => (
          <ListItem
            key={account.id}
            title={account.name}
            subtitle={coupleSubtitle(account) ?? undefined}
            meta={accountCreatedLabel(account.createdAt)}
            trailing={
              <StatusChip
                label={accountStatusLabel(account.status)}
                tone={accountStatusTone(account.status)}
                size="sm"
              />
            }
            onPress={() => onOpen(account.id)}
            accessibilityLabel={accountRowSummary(account.name, account.status)}
            testID={`account-row-${account.id}`}
          />
        ))}
      </Stack>
    </Card>
  );
}
