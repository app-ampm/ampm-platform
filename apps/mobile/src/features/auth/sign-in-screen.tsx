import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useDevLogin } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import {
  Button,
  Card,
  Input,
  Link,
  Row,
  Screen,
  ScreenHeader,
  Stack,
  Text,
  useBreakpoint,
  useIsClient,
} from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

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

/** Signs in against the local `/auth/dev-login`, stores the token, and lets the entry gate route by role. */
function useDevSignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const devLogin = useDevLogin();

  const signIn = (email: string): void => {
    const trimmed = email.trim();
    if (trimmed.length === 0 || devLogin.isPending) return;
    devLogin.mutate(
      { email: trimmed },
      {
        onSuccess: (result) => {
          setAccessToken(result.accessToken);
          // Clear (not just invalidate) so signing in as a different principal never shows the previous
          // one's cached data; the "/" gate then routes by principal type (staff vs client).
          queryClient.clear();
          router.replace("/");
        },
      },
    );
  };

  const errorText =
    devLogin.isError && isAppError(devLogin.error) ? devLogin.error.message : undefined;
  return { signIn, pending: devLogin.isPending, errorText };
}

type DevSignIn = ReturnType<typeof useDevSignIn>;

/** The wordmark over "Welcome back." (P1, D1). */
function SignInHeader() {
  return (
    <Stack gap={8}>
      <Text variant="wordmark">AMPM</Text>
      <ScreenHeader
        title="Welcome"
        emphasis="back."
        subtitle="Development sign-in: use a seeded account."
      />
    </Stack>
  );
}

/**
 * Development sign-in for the demo. A seeded staff or client email is exchanged for a local access token
 * via `/auth/dev-login` (refused outside a local, non-production config). Staff land in their first
 * workspace area, clients in the portal. The production sign-in is Cognito, which ships with the
 * hosting. P1 on a phone; from 768 up the D1 card, centred on the canvas.
 */
export function SignInScreen() {
  const session = useDevSignIn();
  const isClient = useIsClient();
  const { atLeast } = useBreakpoint();
  // The server knows no window: it renders the phone layout and the client takes over after hydration.
  if (isClient && atLeast("md")) {
    return (
      <Screen glow="top" contentClassName="grow items-center justify-center">
        <Card padding="lg" className="w-full max-w-md md:p-9">
          <Stack gap={6}>
            <SignInHeader />
            <SignInChoices session={session} nested />
          </Stack>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen glow="top" header={<SignInHeader />}>
      <SignInChoices session={session} nested={false} />
    </Screen>
  );
}

interface ChoicesProps {
  readonly session: DevSignIn;
  /** Inside the desktop card: the groups are flat tints instead of glass cards of their own. */
  readonly nested: boolean;
}

/** The email form (the one gold action), the seeded quick sign-ins and the gallery link. */
function SignInChoices({ session, nested }: ChoicesProps) {
  const { signIn, pending, errorText } = session;
  const form = <EmailSignIn onSubmit={signIn} pending={pending} errorText={errorText} />;
  return (
    <>
      {nested ? form : <Card>{form}</Card>}
      <QuickSignIn
        title="Staff"
        users={DEMO_STAFF}
        onPick={signIn}
        pending={pending}
        nested={nested}
      />
      <QuickSignIn
        title="Clients"
        users={DEMO_CLIENTS}
        onPick={signIn}
        pending={pending}
        nested={nested}
      />
      <Link
        href="/gallery"
        variant="nav"
        accessibilityLabel="Component gallery"
        className="self-center"
      >
        Component gallery →
      </Link>
    </>
  );
}

function EmailSignIn({
  onSubmit,
  pending,
  errorText,
}: {
  readonly onSubmit: (email: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
}) {
  const [email, setEmail] = useState("");
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
        onSubmitEditing={() => onSubmit(email)}
      />
      <Button
        fullWidth
        size="lg"
        loading={pending}
        disabled={email.trim().length === 0}
        onPress={() => onSubmit(email)}
      >
        Sign in
      </Button>
    </Stack>
  );
}

function QuickSignIn({
  title,
  users,
  onPick,
  pending,
  nested,
}: {
  readonly title: string;
  readonly users: ReadonlyArray<{ readonly email: string; readonly label: string }>;
  readonly onPick: (email: string) => void;
  readonly pending: boolean;
  readonly nested: boolean;
}) {
  return (
    <Card tone={nested ? "flat" : "glass"} padding={nested ? "sm" : "md"}>
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
    </Card>
  );
}
