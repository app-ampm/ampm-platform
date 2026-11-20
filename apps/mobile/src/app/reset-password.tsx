import { useLocalSearchParams } from "expo-router";

import { ResetPasswordScreen } from "@/features/auth/reset-password-screen";

/** The link token; a repeated or blank `token` counts as the first non-blank one. */
function tokenOf(value: string | string[] | undefined): string | undefined {
  const values = Array.isArray(value) ? value : [value];
  return values.map((token) => token?.trim()).find((token) => Boolean(token));
}

/** `/reset-password?token=…`, the link in the password-reset email (D-142). Reachable signed out. */
export default function ResetPasswordRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  return <ResetPasswordScreen token={tokenOf(token)} />;
}
