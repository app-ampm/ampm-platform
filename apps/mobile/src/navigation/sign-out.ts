import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { setAccessToken } from "@/lib/session";

/**
 * Signs out: drops the access token, clears (not just invalidates) the cached server data so the next
 * person never sees the previous one's, and returns to sign-in. Used by the account screen and the
 * staff rail, and through `useGoToSignIn` by the screens a 401 sends back to sign-in; screens keep no
 * sign-out of their own.
 *
 *   const signOut = useSignOut();
 *   <Button variant="secondary" onPress={signOut}>Sign out</Button>
 */
export function useSignOut(): () => void {
  const router = useRouter();
  const queryClient = useQueryClient();
  return () => {
    setAccessToken(null);
    queryClient.clear();
    router.replace("/sign-in");
  };
}
