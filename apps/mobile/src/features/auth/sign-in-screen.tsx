import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useDevLogin } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Input, Link, Row, Stack, Text } from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

/** Seeded staff accounts offered for one-tap sign-in in the demo (apps/api/prisma/seed.ts). */
const DEMO_USERS = [
  { email: "sales@example.com", label: "Sameer Sales" },
  { email: "admin@example.com", label: "Asha Admin" },
] as const;

/** Signs in against the local `/auth/dev-login`, stores the token, and opens the Sales workspace. */
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
          // Clear (not just invalidate) so signing in as a different staff member never shows the
          // previous principal's cached, INTERNAL lead data before the refetch resolves.
          queryClient.clear();
          router.replace("/leads");
        },
      },
    );
  };

  const errorText =
    devLogin.isError && isAppError(devLogin.error) ? devLogin.error.message : undefined;
  return { signIn, pending: devLogin.isPending, errorText };
}

/**
 * Development sign-in for the Sales workspace. A seeded staff email is exchanged for a local access
 * token via `/auth/dev-login` (the API refuses this outside a local, non-production config). Not the
 * production sign-in — that is Cognito, which ships with the hosting.
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
        <Text variant="title">Sales workspace</Text>
        <Text tone="muted">Development sign-in — use a seeded staff account.</Text>
      </Stack>
      <EmailSignIn onSubmit={signIn} pending={pending} errorText={errorText} />
      <QuickSignIn onPick={signIn} pending={pending} />
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
  onPick,
  pending,
}: {
  readonly onPick: (email: string) => void;
  readonly pending: boolean;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="muted">
        Quick sign-in
      </Text>
      <Row gap={2} wrap>
        {DEMO_USERS.map((user) => (
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
