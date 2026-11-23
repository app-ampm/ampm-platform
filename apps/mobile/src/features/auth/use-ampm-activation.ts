import { useState } from "react";

import { useActivationConfirm, useActivationPassword } from "@ampm/api-client";

import { messageOf } from "./refusal-text";
import { useStartSession } from "./use-start-session";

/** Where activation is: choosing the password, adding the authenticator, or saving the recovery codes. */
export type ActivationPhase =
  | { readonly kind: "password" }
  | { readonly kind: "enrol"; readonly secret: string; readonly otpauthUri: string }
  | { readonly kind: "recoveryCodes"; readonly codes: readonly string[] };

export interface AmpmActivation {
  readonly phase: ActivationPhase;
  readonly pending: boolean;
  readonly error: string | undefined;
  readonly setPassword: (password: string) => void;
  readonly confirmCode: (code: string) => void;
  readonly finish: () => void;
}

/**
 * Activating an invitation with AMPM's own sign-in (D-142): the password, then the authenticator's first
 * code; the account turns active and its recovery codes are shown once, after which the session starts.
 *
 *   const activation = useAmpmActivation(token); // activation.setPassword(password)
 */
export function useAmpmActivation(inviteToken: string): AmpmActivation {
  const startSession = useStartSession();
  const password = useActivationPassword();
  const confirm = useActivationConfirm();
  const [phase, setPhase] = useState<ActivationPhase>({ kind: "password" });
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const run = (work: () => Promise<void>): void => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    void work()
      .catch((caught: unknown) => setError(messageOf(caught)))
      .finally(() => setPending(false));
  };

  return {
    phase,
    pending,
    error,
    setPassword: (value) =>
      run(async () => {
        const { enrolment } = await password.mutateAsync({ token: inviteToken, password: value });
        setPhase({ kind: "enrol", secret: enrolment.secret, otpauthUri: enrolment.otpauthUri });
      }),
    confirmCode: (code) =>
      run(async () => {
        const grant = await confirm.mutateAsync({ token: inviteToken, code });
        setGrantToken(grant.accessToken);
        setPhase({ kind: "recoveryCodes", codes: grant.recoveryCodes });
      }),
    finish: () => {
      if (!grantToken) return;
      startSession(grantToken);
    },
  };
}
