import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useDemoSignIn, useDevLogin } from "@ampm/api-client";
import { isAppError, type DevLoginResponse } from "@ampm/core";
import { SignInLayout, Text } from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

import { DevSignInShortcuts } from "./dev-sign-in-shortcuts";
import { MobileOtpSignIn } from "./mobile-otp-sign-in";
import { SignInHero } from "./sign-in-hero";

/** Signs in against the local dev endpoints, stores the token, and lets the entry gate route by role. */
function useDevSignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const devLogin = useDevLogin();
  const demo = useDemoSignIn();
  // The typed work email lives here, above the layout, so it survives a change of arrangement.
  const [email, setEmail] = useState("");

  // Clear (not just invalidate) so signing in as a different principal never shows the previous one's
  // cached data; the "/" gate then routes by principal type (staff, client or demo).
  const applySession = (result: DevLoginResponse): void => {
    setAccessToken(result.accessToken);
    queryClient.clear();
    router.replace("/");
  };

  const signIn = (address: string): void => {
    const trimmed = address.trim();
    if (trimmed.length === 0 || devLogin.isPending) return;
    devLogin.mutate({ email: trimmed }, { onSuccess: applySession });
  };

  const enterDemo = (): void => {
    if (demo.isPending) return;
    demo.mutate(undefined, { onSuccess: applySession });
  };

  const error = devLogin.error ?? demo.error;
  const errorText = isAppError(error) ? error.message : undefined;
  const pending = devLogin.isPending;
  return { signIn, enterDemo, pending, demoPending: demo.isPending, errorText, email, setEmail };
}

/**
 * Development sign-in for the demo. A seeded staff or client email is exchanged for a local access token
 * via `/auth/dev-login`, and "Explore the demo" enters the seeded demo prospect (P-7) via
 * `/auth/dev-login/demo`; both are refused outside a local, non-production config. Staff land in their first
 * workspace area, clients in the portal. The production sign-in is Cognito, which ships with the
 * hosting. P1 on a phone, one centred card from 768, D1's split from 1024: the client mobile + code
 * form alone in the glass card, the development shortcuts under it.
 */
export function SignInScreen() {
  const session = useDevSignIn();
  return (
    <SignInLayout
      testID="sign-in"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={
        <SignInHero subtitle="Development sign-in — client mobile + one-time code, or a seeded account." />
      }
      cardTitle="Client sign-in"
      card={<MobileOtpSignIn />}
      aside={<DevSignInShortcuts {...session} />}
      footer="No sign-up · AMPM invites every client"
    />
  );
}
