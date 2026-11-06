import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useDevLogin } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Input, Link, Row, Stack, Text } from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

/** Seeded accounts offered for one-tap sign-in in the demo (apps/api/prisma/seed.ts). */
const DEMO_STAFF = [
  { email: "sales@example.com", label: "Sameer Sales" },
  { email: "admin@example.com", label: "Asha Admin" },
  { email: "hotel@example.com", label: "Hema Hotels" },
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

/**
 * Development sign-in for the demo. A seeded staff or client email is exchanged for a local access token
 * via `/auth/dev-login` (refused outside a local, non-production config). Staff land in the Sales
 * workspace, clients in the portal. The production sign-in is Cognito, which ships with the hosting.
 */
export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, pending, errorText } = useDevSignIn();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-6 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Stack gap={1}>
        <Text variant="title">AMPM</Text>
        <Text tone="muted">Development sign-in — use a seeded account.</Text>
      </Stack>
      <EmailSignIn onSubmit={signIn} pending={pending} errorText={errorText} />
      <QuickSignIn title="Staff" users={DEMO_STAFF} onPick={signIn} pending={pending} />
      <QuickSignIn title="Client" users={DEMO_CLIENTS} onPick={signIn} pending={pending} />
      <Link href="/gallery" variant="standalone" tone="muted">
        Component gallery
      </Link>
    </ScrollView>
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
    <Stack gap={3}>
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
}: {
  readonly title: string;
  readonly users: ReadonlyArray<{ readonly email: string; readonly label: string }>;
  readonly onPick: (email: string) => void;
  readonly pending: boolean;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="muted">
        {title}
      </Text>
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
