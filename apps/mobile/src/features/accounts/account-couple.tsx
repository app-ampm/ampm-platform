import type { AccountDetailView } from "@ampm/core";
import { Card, Stack, Text } from "@ampm/ui";

interface PartnerProps {
  readonly role: string;
  readonly name: string | null;
  readonly fatherName: string | null;
  readonly testID: string;
}

/** One of the couple: their name, and their father's under it once given. */
function Partner({ role, name, fatherName, testID }: PartnerProps) {
  return (
    <Stack gap={1} testID={testID}>
      <Text variant="label" tone="muted">
        {role}
      </Text>
      <Text variant="body">{name ?? "Not given yet"}</Text>
      {fatherName ? <Text variant="bodySmall" tone="muted">{`Father: ${fatherName}`}</Text> : null}
    </Stack>
  );
}

export interface AccountCoupleProps {
  readonly account: Pick<
    AccountDetailView,
    "brideName" | "brideFatherName" | "groomName" | "groomFatherName"
  >;
}

/**
 * The couple the client account is for, first among the record's side panels: the bride and the groom,
 * each with their father's name. Staff add them in Edit details; a name not given yet says so.
 *
 *   <AccountCouple account={account} />
 */
export function AccountCouple({ account }: AccountCoupleProps) {
  return (
    <Stack gap={2} testID="account-couple-panel">
      <Text variant="heading">Couple</Text>
      <Card padding="sm">
        <Stack gap={3}>
          <Partner
            role="Bride"
            name={account.brideName}
            fatherName={account.brideFatherName}
            testID="account-bride"
          />
          <Partner
            role="Groom"
            name={account.groomName}
            fatherName={account.groomFatherName}
            testID="account-groom"
          />
        </Stack>
      </Card>
    </Stack>
  );
}
