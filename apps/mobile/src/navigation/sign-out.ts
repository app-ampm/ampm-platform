import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useSignOut as useServerSignOut } from "@ampm/api-client";

import { cognitoSignOut } from "@/lib/cognito-auth";
import { env } from "@/lib/env";
import { setAccessToken, setCognitoSignedIn } from "@/lib/session";

/**
 * Signs out: ends the session (Cognito's tokens, or the local dev-login token), clears (not just
 * invalidates) the cached server data so the next person never sees the previous one's, and returns to
 * sign-in. Used by the account screen and the staff rail, and through `useGoToSignIn` by the screens a
 * 401 sends back to sign-in; screens keep no sign-out of their own.
 *
 *   const signOut = useSignOut();
 *   <Button variant="secondary" onPress={signOut}>Sign out</Button>
 */
export function useSignOut(): () => void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const serverSignOut = useServerSignOut();
  const leave = (): void => {
    queryClient.clear();
    router.replace("/sign-in");
  };
  return () => {
    const provider = env.EXPO_PUBLIC_IDENTITY_PROVIDER;
    if (provider === "cognito") {
      void cognitoSignOut().finally(() => {
        setCognitoSignedIn(false);
      });
    } else if (provider === "ampm") {
      // End the server-side session with the token first (best effort), then drop it here (D-142).
      void serverSignOut
        .mutateAsync()
        .catch(() => undefined)
        .finally(() => {
          setAccessToken(null);
        });
    } else {
      setAccessToken(null);
    }
    leave();
  };
}
