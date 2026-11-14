import { Button, Card, Input, Link, Row, Stack, Text, useSignInLayoutMode } from "@ampm/ui";

/** Seeded accounts offered for one-tap sign-in in the demo (apps/api/prisma/seed.ts). */
const DEMO_STAFF = [
  { email: "sales@example.com", label: "Sameer Sales" },
  { email: "admin@example.com", label: "Asha Admin" },
  { email: "hotel@example.com", label: "Hema Hotels" },
  { email: "finance@example.com", label: "Farah Finance" },
] as const;
const DEMO_CLIENTS = [
  // Rhea is an entitled client (hotel assistance) — the Flow-2 client. Prasad is a demo prospect whose
  // assistance request is routed to Sales (P-7), so he is not a consultancy client.
  { email: "client@example.com", label: "Rhea Client" },
  { email: "prospect@example.com", label: "Prasad Prospect" },
] as const;

export interface DevSignInShortcutsProps {
  /** Exchanges a seeded email for a local token (`/auth/dev-login`). */
  readonly signIn: (email: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
  /**
   * The typed work email, held by the screen: this block is arranged differently at each width, so
   * state kept in here would be lost when a tablet turns or a window is resized.
   */
  readonly email: string;
  readonly setEmail: (value: string) => void;
}

function EmailSignIn({ signIn, pending, errorText, email, setEmail }: DevSignInShortcutsProps) {
  return (
    <Stack gap={4}>
      <Input
        label="Work email"
        value={email}
        onChangeText={setEmail}
        placeholder="sales@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        errorText={errorText}
        onSubmitEditing={() => signIn(email)}
      />
      <Button
        fullWidth
        size="lg"
        variant="secondary"
        loading={pending}
        disabled={email.trim().length === 0}
        onPress={() => signIn(email)}
      >
        Sign in
      </Button>
    </Stack>
  );
}

interface QuickGroupProps {
  readonly title: string;
  readonly users: ReadonlyArray<{ readonly email: string; readonly label: string }>;
  readonly onPick: (email: string) => void;
  readonly pending: boolean;
}

/** One tap per seeded account, under its group's eyebrow. */
function QuickGroup({ title, users, onPick, pending }: QuickGroupProps) {
  return (
    <Stack gap={3}>
      <Text variant="eyebrow">{title}</Text>
      <Row gap={2} wrap>
        {users.map((user) => (
          <Button
            key={user.email}
            variant="secondary"
            size="sm"
            loading={pending}
            onPress={() => onPick(user.email)}
          >
            {user.label}
          </Button>
        ))}
      </Row>
    </Stack>
  );
}

/** A group on a card of its own: glass on a phone, a flat tint inside the centred card. */
function QuickSignIn({ nested, ...group }: QuickGroupProps & { readonly nested: boolean }) {
  return (
    <Card tone={nested ? "flat" : "glass"} padding={nested ? "sm" : "md"}>
      <QuickGroup {...group} />
    </Card>
  );
}

function GalleryLink() {
  return (
    <Link
      href="/gallery"
      variant="nav"
      accessibilityLabel="Component gallery"
      className="self-center"
    >
      Component gallery →
    </Link>
  );
}

/**
 * The development-only ways in after the client form: the work-email form, the seeded quick sign-ins
 * and the gallery link. A phone gives each a glass card (P1); the centred card holds them as flat
 * tints. Under D1's card they share one flat block, quieter than the form and short enough to sit
 * beside the headline on a 900-high window.
 */
export function DevSignInShortcuts(session: DevSignInShortcutsProps) {
  const mode = useSignInLayoutMode();
  const staff = {
    title: "Staff",
    users: DEMO_STAFF,
    onPick: session.signIn,
    pending: session.pending,
  };
  const clients = { ...staff, title: "Clients", users: DEMO_CLIENTS };
  if (mode === "split") {
    return (
      <>
        <Card tone="flat" padding="sm" testID="dev-sign-in-shortcuts">
          <Stack gap={4}>
            <EmailSignIn {...session} />
            <QuickGroup {...staff} />
            <QuickGroup {...clients} />
          </Stack>
        </Card>
        <GalleryLink />
      </>
    );
  }
  const nested = mode === "card";
  return (
    <>
      {nested ? (
        <EmailSignIn {...session} />
      ) : (
        <Card>
          <EmailSignIn {...session} />
        </Card>
      )}
      <QuickSignIn {...staff} nested={nested} />
      <QuickSignIn {...clients} nested={nested} />
      <GalleryLink />
    </>
  );
}
