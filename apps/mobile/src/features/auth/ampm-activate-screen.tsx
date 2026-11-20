import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { ACTIVATION_ERRORS, SIGN_IN_ERRORS, type InvitationPreview } from "@ampm/core";
import { useInvitationPreview } from "@ampm/api-client";
import { Button, SignInLayout, Stack, Text } from "@ampm/ui";

import { EnrollForm, RecoveryCodesForm } from "./authenticator-forms";
import { SignInHero } from "./sign-in-hero";
import { NewPasswordForm } from "./staff-sign-in-forms";
import { useAmpmActivation, type AmpmActivation } from "./use-ampm-activation";

/** A short notice in place of the form, with an optional way on. */
function Notice({ text, action }: { readonly text: string; readonly action?: ReactNode }) {
  return (
    <Stack gap={4}>
      <Text variant="body">{text}</Text>
      {action}
    </Stack>
  );
}

function SignInLink() {
  const router = useRouter();
  return (
    <Button fullWidth onPress={() => router.replace("/sign-in")}>
      Go to sign-in
    </Button>
  );
}

/** The refusal behind a failed invitation lookup, in words for the person holding the link. */
function previewFailure(message: string | undefined) {
  if (message === ACTIVATION_ERRORS.alreadyActive) {
    return (
      <Notice text="This account is already active. Sign in instead." action={<SignInLink />} />
    );
  }
  return (
    <Notice text="This invitation is invalid or has expired. Ask AMPM to send you a new one." />
  );
}

/** Activation step one: greet the invited person and take their new password. */
function PasswordStep({
  invitation,
  activation,
}: {
  readonly invitation: InvitationPreview;
  readonly activation: AmpmActivation;
}) {
  return (
    <Stack gap={4}>
      <Text variant="body">
        Welcome, {invitation.name}. Choose a password for {invitation.email}.
      </Text>
      <NewPasswordForm
        onSubmit={activation.setPassword}
        pending={activation.pending}
        errorText={activation.error}
        cta="Continue"
      />
    </Stack>
  );
}

function ActivationSteps({
  token,
  invitation,
}: {
  readonly token: string;
  readonly invitation: InvitationPreview;
}) {
  const activation = useAmpmActivation(token);
  const { phase, pending, error } = activation;
  if (invitation.userType !== "staff") {
    return <Notice text={SIGN_IN_ERRORS.clientActivationUnavailable} />;
  }
  switch (phase.kind) {
    case "password":
      return <PasswordStep invitation={invitation} activation={activation} />;
    case "enrol":
      return (
        <EnrollForm
          secret={phase.secret}
          otpauthUri={phase.otpauthUri}
          onSubmit={activation.confirmCode}
          pending={pending}
          errorText={error}
          cta="Verify and activate"
        />
      );
    case "recoveryCodes":
      return <RecoveryCodesForm codes={phase.codes} onDone={activation.finish} />;
  }
}

function ActivationCard({ token }: { readonly token: string | undefined }) {
  const preview = useInvitationPreview(token);
  if (!token) {
    return (
      <Notice text="This invitation link is incomplete. Open the link from your email again." />
    );
  }
  if (preview.isPending) return <Notice text="Checking your invitation…" />;
  if (preview.isError) return previewFailure(preview.error.message);
  return <ActivationSteps token={token} invitation={preview.data} />;
}

/**
 * Account activation with AMPM's own sign-in (`EXPO_PUBLIC_IDENTITY_PROVIDER=ampm`, D-142), where the
 * invitation email's link lands (`/activate?token=…`): the person chooses a password, adds the
 * authenticator from the QR code, confirms it with its first code and saves the recovery codes; only
 * then is the account active. The sign-in screen's arrangement, signed out and outside both chromes.
 *
 *   <AmpmActivateScreen inviteToken={token} />
 */
export function AmpmActivateScreen({ inviteToken }: { readonly inviteToken: string | undefined }) {
  return (
    <SignInLayout
      testID="activate"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={
        <SignInHero
          headline="activate"
          subtitle="You've been invited to AMPM. Set your password and authenticator, and you're in."
        />
      }
      cardTitle="Activate your account"
      card={<ActivationCard token={inviteToken} />}
      footer="Invitation only · each link works once"
    />
  );
}
