import { useLocalSearchParams } from "expo-router";

import { ActivateScreen } from "@/features/auth/activate-screen";
import { AmpmActivateScreen } from "@/features/auth/ampm-activate-screen";
import { env } from "@/lib/env";

/** The invite token from the link; a repeated or blank `token` counts as the first non-blank one. */
function inviteTokenOf(value: string | string[] | undefined): string | undefined {
  const values = Array.isArray(value) ? value : [value];
  return values.map((token) => token?.trim()).find((token) => Boolean(token));
}

/** `/activate?token=…`, the link in the invitation email. Reachable signed out (no session gate). */
export default function ActivateRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  // AMPM's own sign-in sets the password and the authenticator here (D-142); the dev provider redeems
  // the link for a local token instead.
  return env.EXPO_PUBLIC_IDENTITY_PROVIDER === "ampm" ? (
    <AmpmActivateScreen inviteToken={inviteTokenOf(token)} />
  ) : (
    <ActivateScreen inviteToken={inviteTokenOf(token)} />
  );
}
