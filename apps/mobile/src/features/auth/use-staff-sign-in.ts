import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  needsTotpEnrollment,
  staffSignIn,
  submitStaffChallenge,
  type StaffAuthStep,
} from "@/lib/cognito-auth";
import { setCognitoSignedIn } from "@/lib/session";

/** The step the sign-in screen is showing, mapped from Cognito's challenges. */
export type Phase =
  | { readonly kind: "credentials" }
  | { readonly kind: "totpCode" }
  | { readonly kind: "newPassword" }
  | { readonly kind: "enrollTotp"; readonly secret: string; readonly otpauthUri: string };

export interface StaffSignIn {
  readonly phase: Phase;
  readonly pending: boolean;
  readonly error: string | undefined;
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly signIn: (password: string) => void;
  readonly submitChallenge: (answer: string) => void;
  readonly confirmEnrollment: (code: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "Something went wrong. Please try again.";
}

async function enrollPhase(email: string): Promise<Phase> {
  const setup = await beginTotpEnrollment(email);
  return { kind: "enrollTotp", secret: setup.secret, otpauthUri: setup.otpauthUri };
}

/** Drives the staff Cognito sign-in: password over SRP, the TOTP / new-password challenges, and first-run enrolment. */
export function useStaffSignIn(): StaffSignIn {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: "credentials" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState("");

  const complete = (): void => {
    setCognitoSignedIn(true);
    // Clear (not just invalidate) so a new principal never sees the previous one's cached data.
    queryClient.clear();
    router.replace("/");
  };

  const apply = async (step: StaffAuthStep): Promise<void> => {
    if (step.kind !== "done") setPhase({ kind: step.kind });
    else if (await needsTotpEnrollment()) setPhase(await enrollPhase(email));
    else complete();
  };

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
    email,
    setEmail,
    signIn: (password) => run(() => staffSignIn(email, password).then(apply)),
    submitChallenge: (answer) => run(() => submitStaffChallenge(answer).then(apply)),
    confirmEnrollment: (code) => run(() => confirmTotpEnrollment(code).then(complete)),
  };
}
