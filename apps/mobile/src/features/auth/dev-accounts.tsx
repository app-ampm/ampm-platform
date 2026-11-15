import {
  Avatar,
  Button,
  Card,
  Divider,
  Grid,
  Input,
  ListItem,
  Stack,
  Text,
  type AvatarTone,
  type CardTone,
} from "@ampm/ui";

/** A seeded account offered for one-tap sign-in in the demo (apps/api/prisma/seed.ts). */
interface SeededAccount {
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

const DEMO_STAFF: readonly SeededAccount[] = [
  { email: "sales@example.com", name: "Sameer Sales", role: "Sales" },
  { email: "admin@example.com", name: "Asha Admin", role: "Super Admin" },
  { email: "hotel@example.com", name: "Hema Hotels", role: "Hotel team" },
  { email: "finance@example.com", name: "Farah Finance", role: "Finance" },
];
const DEMO_CLIENTS: readonly SeededAccount[] = [
  // Rhea is an entitled client (hotel assistance), the Flow-2 client. Prasad is a prospect whose
  // assistance request is routed to Sales (P-7), so he is not a consultancy client.
  { email: "client@example.com", name: "Rhea Client", role: "Client" },
  { email: "prospect@example.com", name: "Prasad Prospect", role: "Prospect" },
];

export interface DevAccountsProps {
  /** Exchanges a seeded email for a local token (`/auth/dev-login`). */
  readonly signIn: (email: string) => void;
  /** The email being signed in, while it is. */
  readonly pendingEmail: string | undefined;
  readonly errorText: string | undefined;
  /** The typed work email and whether its form is open, held by the screen so a resize keeps them. */
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly emailOpen: boolean;
  readonly setEmailOpen: (open: boolean) => void;
  readonly tone: CardTone;
  /** Two beside each other under D1's card; one a row in the narrower centred card and on a phone. */
  readonly columns: 1 | 2;
}

interface GroupProps {
  readonly title: string;
  readonly accounts: readonly SeededAccount[];
  readonly avatarTone: AvatarTone;
  readonly signIn: (email: string) => void;
  readonly pendingEmail: string | undefined;
  readonly columns: 1 | 2;
}

/** One row per account: initials, name and role; one tap signs in as it. */
function AccountGroup({ title, accounts, avatarTone, signIn, pendingEmail, columns }: GroupProps) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow">{title}</Text>
      <Grid columns={{ base: columns, md: columns, lg: columns }} gap={2}>
        {accounts.map((account) => (
          <ListItem
            key={account.email}
            title={account.name}
            subtitle={account.role}
            leading={<Avatar name={account.name} size="sm" tone={avatarTone} />}
            trailing={
              pendingEmail === account.email ? (
                <Text variant="caption">Signing in…</Text>
              ) : undefined
            }
            showChevron={pendingEmail !== account.email}
            onPress={() => signIn(account.email)}
            accessibilityLabel={`Sign in as ${account.name}, ${account.role}`}
            testID={`dev-account-${account.email}`}
          />
        ))}
      </Grid>
    </Stack>
  );
}

/** Any other seeded email, behind a link so the one-tap rows lead. */
function OtherEmail(props: DevAccountsProps) {
  if (!props.emailOpen) {
    return (
      <Button variant="ghost" size="sm" icon="mail" onPress={() => props.setEmailOpen(true)}>
        Use another seeded email
      </Button>
    );
  }
  const submit = () => props.signIn(props.email);
  return (
    <Stack gap={3}>
      <Input
        label="Work email"
        value={props.email}
        onChangeText={props.setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        onSubmitEditing={submit}
      />
      <Button
        fullWidth
        variant="secondary"
        loading={props.pendingEmail !== undefined && props.pendingEmail === props.email.trim()}
        disabled={props.email.trim().length === 0}
        onPress={submit}
      >
        Sign in
      </Button>
    </Stack>
  );
}

/**
 * The seeded accounts of the development sign-in: staff and clients as one-tap rows (initials, name,
 * role), then any other seeded email. Refused outside a local, non-production config, like every
 * development way in.
 */
export function DevAccounts(props: DevAccountsProps) {
  const group = { signIn: props.signIn, pendingEmail: props.pendingEmail, columns: props.columns };
  return (
    <Card tone={props.tone} padding="md" testID="dev-accounts">
      <Stack gap={4}>
        <Stack gap={1}>
          <Text variant="subheading">Development accounts</Text>
          <Text variant="bodySmall" tone="muted">
            One tap signs in as a seeded account.
          </Text>
        </Stack>
        {props.errorText ? (
          <Text variant="bodySmall" tone="brand" accessibilityRole="alert">
            {props.errorText}
          </Text>
        ) : null}
        <AccountGroup title="Staff" accounts={DEMO_STAFF} avatarTone="brand" {...group} />
        <AccountGroup title="Clients" accounts={DEMO_CLIENTS} avatarTone="highlight" {...group} />
        <Divider />
        <OtherEmail {...props} />
      </Stack>
    </Card>
  );
}
