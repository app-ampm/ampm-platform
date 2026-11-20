import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useActivate, useDevInviteSignIn } from "@ampm/api-client";

import { setAccessToken } from "@/lib/session";

import {
  activationRefusal,
  type ActivationFailure,
  type ActivationRefusal,
} from "./activation-outcome";

/** What the activation screen shows. */
export type ActivationStep =
  /** The link carries no token: nothing to activate. */
  | { readonly kind: "missing-link" }
  /** Ready to activate; after a refusal that can be tried again, why it failed. */
  | { readonly kind: "ready"; readonly failure: ActivationFailure | undefined }
  /** Activated, and signed in as the account. */
  | { readonly kind: "activated" }
  /** The link no longer works: expired, superseded or already redeemed. */
  | { readonly kind: "expired" }
  | { readonly kind: "already-active" };

export interface AccountActivation {
  readonly step: ActivationStep;
  readonly pending: boolean;
  readonly activate: () => void;
  /** After activation: into the app, where the entry route sends the account to its home. */
  readonly continueToApp: () => void;
  readonly goToSignIn: () => void;
}

type Outcome = { readonly kind: "activated" } | ActivationRefusal;

function stepOf(inviteToken: string | undefined, outcome: Outcome | null): ActivationStep {
  if (!inviteToken) return { kind: "missing-link" };
  if (outcome && outcome.kind !== "failed") return outcome;
  return { kind: "ready", failure: outcome?.kind === "failed" ? outcome.reason : undefined };
}

/**
 * Activates the account an invitation link names (`/activate?token=…`, D-041) under the development
 * provider, where the link stands in for the provider sign-in: `useDevInviteSignIn` exchanges it for a
 * local token, then `useActivate` presents that token with the invite token, and the API links the
 * identity and activates the account. The local token is then the account's session, so the person is
 * signed in on success. AMPM's own sign-in activates on its own screen (`AmpmActivateScreen`, D-142).
 *
 *   const activation = useAccountActivation(token);
 *   <Button loading={activation.pending} onPress={activation.activate}>Activate account</Button>
 */
export function useAccountActivation(inviteToken: string | undefined): AccountActivation {
  const router = useRouter();
  const queryClient = useQueryClient();
  const devInvite = useDevInviteSignIn();
  const activation = useActivate();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, setPending] = useState(false);

  const redeem = async (token: string): Promise<void> => {
    const { accessToken } = await devInvite.mutateAsync({ token });
    await activation.mutateAsync({ token, accessToken });
    setAccessToken(accessToken);
    // Clear, not invalidate: whoever was signed in before, nothing of theirs may show.
    queryClient.clear();
  };

  const activate = (): void => {
    if (!inviteToken || pending) return;
    setPending(true);
    void redeem(inviteToken)
      .then(() => setOutcome({ kind: "activated" }))
      .catch((error: unknown) => setOutcome(activationRefusal(error)))
      .finally(() => setPending(false));
  };

  return {
    step: stepOf(inviteToken, outcome),
    pending,
    activate,
    continueToApp: () => router.replace("/"),
    goToSignIn: () => router.replace("/sign-in"),
  };
}
