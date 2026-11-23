import { useState } from "react";

import { SIGN_IN_ERRORS } from "@ampm/core";
import { useSignIn, useSignInCode } from "@ampm/api-client";

import { messageOf } from "./refusal-text";
import type { Phase, StaffSignIn } from "./staff-sign-in.types";
import { useStartSession } from "./use-start-session";

/** Runs one step at a time, keeping its pending flag and error; a timed-out challenge restarts sign-in. */
function useStepRunner(onExpired: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const run = (work: () => Promise<void>): void => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    void work()
      .catch((caught: unknown) => {
        const message = messageOf(caught);
        if (message === SIGN_IN_ERRORS.challengeExpired) onExpired();
        setError(message);
      })
      .finally(() => setPending(false));
  };
  return { pending, error, setError, run };
}

/**
 * Drives the staff sign-in screen through AMPM's own sign-in (D-142): the password, then the
 * authenticator code or one of the recovery codes. A timed-out challenge returns to the password step
 * with the API's message. The access token becomes the session only at the very end. An account
 * without an authenticator never reaches the code step: it activates from its invitation instead.
 *
 *   const session = useAmpmSignIn(); // <StaffSignInScreen session={session} />
 */
export function useAmpmSignIn(): StaffSignIn {
  const signIn = useSignIn();
  const signInCode = useSignInCode();
  const complete = useStartSession();
  const [phase, setPhase] = useState<Phase>({ kind: "credentials" });
  const [challenge, setChallenge] = useState("");
  const [email, setEmail] = useState("");
  const { pending, error, setError, run } = useStepRunner(() => setPhase({ kind: "credentials" }));
  return {
    phase,
    pending,
    error,
    email,
    setEmail,
    signIn: (password) =>
      run(async () => {
        setChallenge((await signIn.mutateAsync({ email, password })).challenge);
        setPhase({ kind: "totpCode" });
      }),
    submitChallenge: (code) =>
      run(async () => complete((await signInCode.mutateAsync({ challenge, code })).accessToken)),
    toggleRecoveryCode: () => {
      setError(undefined);
      setPhase(phase.kind === "recoveryCode" ? { kind: "totpCode" } : { kind: "recoveryCode" });
    },
    submitRecoveryCode: (recoveryCode) =>
      run(async () =>
        complete((await signInCode.mutateAsync({ challenge, recoveryCode })).accessToken),
      ),
  };
}
