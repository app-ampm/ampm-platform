import type { ReactNode } from "react";

import { SignInLayout, Text, useSignInLayoutMode } from "@ampm/ui";

import { SignInHero } from "./sign-in-hero";
import type { Phase, StaffSignIn } from "./staff-sign-in.types";
import { CodeForm, CredentialsForm, RecoveryCodeForm } from "./staff-sign-in-forms";

const SUBTITLES: Record<Phase["kind"], string> = {
  credentials: "Sign in with your work email and password.",
  totpCode: "Enter the 6-digit code from your authenticator app.",
  recoveryCode: "Enter one of the recovery codes you saved when you set up your authenticator.",
};

/** The second step: the authenticator code, or a recovery code in its place. */
function SecondStepForm({ session }: { readonly session: StaffSignIn }) {
  const { phase, pending, error } = session;
  if (phase.kind === "recoveryCode") {
    return (
      <RecoveryCodeForm
        onSubmit={session.submitRecoveryCode}
        onBack={session.toggleRecoveryCode}
        pending={pending}
        errorText={error}
      />
    );
  }
  return (
    <CodeForm
      label="Authenticator code"
      cta="Verify"
      onSubmit={session.submitChallenge}
      pending={pending}
      errorText={error}
      onUseRecoveryCode={session.toggleRecoveryCode}
    />
  );
}

function PhaseForm({
  session,
  onForgot,
}: {
  readonly session: StaffSignIn;
  readonly onForgot?: () => void;
}) {
  const { phase, pending, error } = session;
  switch (phase.kind) {
    case "credentials":
      return (
        <CredentialsForm
          email={session.email}
          setEmail={session.setEmail}
          onSubmit={session.signIn}
          pending={pending}
          errorText={error}
          onForgot={onForgot}
        />
      );
    case "totpCode":
    case "recoveryCode":
      return <SecondStepForm session={session} />;
  }
}

interface StaffSignInScreenProps {
  readonly session: StaffSignIn;
  /** "Forgot password?" on the first step. */
  readonly onForgot?: () => void;
  /** Quieter ways in under the card: AMPM's own sign-in offers the way back to the client sign-in. */
  readonly aside?: ReactNode;
}

/**
 * The staff sign-in screen (AMPM's own sign-in, D-142): the email and password, then the authenticator
 * code or a recovery code. Clients sign in by mobile + OTP through a separate flow. P1 on a phone, one
 * centred card from 768, D1's split from 1024 with the phase's form alone in the glass card.
 */
export function StaffSignInScreen({ session, onForgot, aside }: StaffSignInScreenProps) {
  const mode = useSignInLayoutMode();
  return (
    <SignInLayout
      testID="sign-in"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={<SignInHero subtitle={SUBTITLES[session.phase.kind]} />}
      // D1's card has a title; P1's staff form never had one, so a phone and the centred card keep none.
      cardTitle={mode === "split" ? "Staff sign-in" : undefined}
      card={<PhaseForm session={session} {...(onForgot ? { onForgot } : {})} />}
      aside={aside}
      footer="No sign-up · AMPM sets up every account"
    />
  );
}
