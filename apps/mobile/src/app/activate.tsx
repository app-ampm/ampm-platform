import { useLocalSearchParams } from "expo-router";

import { ActivateScreen } from "@/features/auth/activate-screen";

/** The invite token from the link; a repeated or blank `token` counts as the first non-blank one. */
function inviteTokenOf(value: string | string[] | undefined): string | undefined {
  const values = Array.isArray(value) ? value : [value];
  return values.map((token) => token?.trim()).find((token) => Boolean(token));
}

/** `/activate?token=…`, the link in the invitation email. Reachable signed out (no session gate). */
export default function ActivateRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  return <ActivateScreen inviteToken={inviteTokenOf(token)} />;
}
