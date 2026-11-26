import { useState } from "react";

import { SIGN_IN_ERRORS, signInRequest, typedEmail } from "@ampm/core";
import { useSignIn, useSignInCode } from "@ampm/api-client";

import { refusalText } from "./refusal-text";
import { STAFF_INPUT_ERRORS } from "./staff-input-errors";
import type { Phase, StaffSignIn } from "./staff-sign-in.types";
import { useStartSession } from "./use-start-session";

/** Runs one step at a time, keeping its pending flag and error; a timed-out challenge restarts sign-in. */
function useStepRunner(onExpired: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const run = (work: () => Promise<void>, invalidInput: string): void => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    void work()
      .catch((caught: unknown) => {
        const message = refusalText(caught, invalidInput) ?? invalidInput;
        if (message === SIGN_IN_ERRORS.challengeExpired) onExpired();
        setError(message);
      })
      .finally(() => setPending(false));
  };
  return { pending, error, setError, run };
}

/** The email when the schema would take it; otherwise the words for the person, thrown before any call. */
function checked(email: string): string {
  if (!signInRequest.shape.email.safeParse(email).success) {
    throw new Error(STAFF_INPUT_ERRORS.credentials);
  }
  return email;
}

/**
 * Drives the staff sign-in screen through AMPM's own sign-in (D-142): the password, then the
 * authenticator code or one of the recovery codes. A timed-out challenge returns to the password step
 * with the API's message. The access token becomes the session only at the very end. An account
 * without an authenticator never reaches the code step: it activates from its invitation instead.
 *
 * The email is sent as `typedEmail` makes it (a phone keyboard's spaces and invisible characters
 * removed) and the field shows what was sent; an email the schema would refuse is answered here,
 * without a call to the API.
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
        const sent = typedEmail(email);
        setEmail(sent);
        setChallenge((await signIn.mutateAsync({ email: checked(sent), password })).challenge);
        setPhase({ kind: "totpCode" });
      }, STAFF_INPUT_ERRORS.credentials),
    submitChallenge: (code) =>
      run(
        async () => complete((await signInCode.mutateAsync({ challenge, code })).accessToken),
        STAFF_INPUT_ERRORS.code,
      ),
    toggleRecoveryCode: () => {
      setError(undefined);
      setPhase(phase.kind === "recoveryCode" ? { kind: "totpCode" } : { kind: "recoveryCode" });
    },
    submitRecoveryCode: (recoveryCode) =>
      run(
        async () =>
          complete((await signInCode.mutateAsync({ challenge, recoveryCode })).accessToken),
        STAFF_INPUT_ERRORS.recoveryCode,
      ),
  };
}
