import { useState } from "react";

import { useDemoSignIn, useDevLogin } from "@ampm/api-client";
import { isAppError, type DevLoginResponse } from "@ampm/core";
import { SignInLayout, Text } from "@ampm/ui";

import { DevSignInShortcuts } from "./dev-sign-in-shortcuts";
import { ClientAccessCard } from "./mobile-otp-sign-in";
import { SignInHero } from "./sign-in-hero";
import { useClientAccess } from "./use-client-access";
import { useStartSession } from "./use-start-session";

/** Signs in against the local dev endpoints, stores the token, and lets the entry gate route by role. */
function useDevSignIn() {
  const startSession = useStartSession();
  const devLogin = useDevLogin();
  const demo = useDemoSignIn();
  // The typed work email (and whether its form is open) live here, above the layout, so they survive a
  // change of arrangement.
  const [email, setEmail] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);

  const applySession = (result: DevLoginResponse): void => startSession(result.accessToken);

  const signIn = (address: string): void => {
    const trimmed = address.trim();
    if (trimmed.length === 0 || devLogin.isPending) return;
    devLogin.mutate({ email: trimmed }, { onSuccess: applySession });
  };

  const enterDemo = (): void => {
    if (demo.isPending) return;
    demo.mutate(undefined, { onSuccess: applySession });
  };

  return {
    signIn,
    pendingEmail: devLogin.isPending ? devLogin.variables.email : undefined,
    errorText: isAppError(devLogin.error) ? devLogin.error.message : undefined,
    enterDemo,
    demoPending: demo.isPending,
    demoErrorText: isAppError(demo.error) ? demo.error.message : undefined,
    email,
    setEmail,
    emailOpen,
    setEmailOpen,
  };
}

/**
 * Development sign-in for the demo. The glass card is the client's: a Sign in / Sign up switch, the
 * mobile (and, to sign up, a name first), then the one-time code shown on screen. Under it, "Explore
 * the demo" enters the seeded demo prospect (P-7) via `/auth/dev-login/demo`, and one tap on a seeded
 * staff or client account exchanges its email for a local token via `/auth/dev-login`. All of it is
 * refused outside a local, non-production config; the production sign-in is AMPM's own
 * (`AmpmSignInScreen`), with no sign-up.
 * P1 on a phone, one centred card from 768, D1's split from 1024.
 */
export function SignInScreen() {
  const session = useDevSignIn();
  const access = useClientAccess();
  return (
    <SignInLayout
      testID="sign-in"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={
        <SignInHero
          headline={access.mode}
          subtitle="Sign in or sign up with your mobile and a one-time code."
        />
      }
      card={<ClientAccessCard access={access} />}
      aside={<DevSignInShortcuts {...session} />}
      footer="Demo build · codes appear on screen, no SMS"
    />
  );
}
