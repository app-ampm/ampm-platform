import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { setAccessToken } from "@/lib/session";

/**
 * Starts the session a sign-in granted: stores the access token, clears the query cache and lets the
 * "/" gate route by principal type (staff, client or demo). Clear, not just invalidate, so a new
 * principal never sees the previous one's cached data.
 *
 *   const startSession = useStartSession(); // startSession(grant.accessToken)
 */
export function useStartSession(): (accessToken: string) => void {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (accessToken) => {
    setAccessToken(accessToken);
    queryClient.clear();
    router.replace("/");
  };
}
