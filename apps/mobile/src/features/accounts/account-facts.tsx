import type { AccountDetailView } from "@ampm/core";
import { Card, Stack, Text } from "@ampm/ui";

import { accountDay } from "./accounts.format";

function FactRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack gap={1}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Stack>
  );
}

/**
 * The record's facts that do not fit the header's one line: the preferred locations (free text, often
 * a list) and when the account last changed. A location not yet given says so, rather than leaving the
 * side column without its first panel.
 */
export function AccountFacts({ account }: { readonly account: AccountDetailView }) {
  return (
    <Stack gap={2} testID="account-facts">
      <Text variant="heading">Details</Text>
      <Card padding="sm">
        <Stack gap={3}>
          <FactRow
            label="Preferred locations"
            value={account.preferredLocations ?? "Not given yet"}
          />
          <FactRow label="Last updated" value={accountDay(account.updatedAt)} />
        </Stack>
      </Card>
    </Stack>
  );
}
