import type { AccountDetailView } from "@ampm/core";
import { Card, Link, Stack, Text } from "@ampm/ui";

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

export interface AccountFactsProps {
  readonly account: AccountDetailView;
  /** Whether the reader may open leads (`crm.leads.read`): the link back to where the client came from. */
  readonly canOpenLead: boolean;
}

/**
 * The record's facts that do not fit the header's one line: the preferred locations (free text, often
 * a list), when the account last changed, and the lead it was converted from. A location not yet given
 * says so, rather than leaving the side column without its first panel.
 */
export function AccountFacts({ account, canOpenLead }: AccountFactsProps) {
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
          {account.leadId && canOpenLead ? (
            <Link
              href={`/leads/${account.leadId}`}
              variant="standalone"
              textVariant="label"
              accessibilityLabel="Open the lead this client came from"
              testID="account-lead-link"
            >
              Originating lead →
            </Link>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
