import { useRouter } from "expo-router";
import type { ReactNode } from "react";

import { ACTIVATION_ERRORS, SIGN_IN_ERRORS, type InvitationPreview } from "@ampm/core";
import { useInvitationPreview } from "@ampm/api-client";
import { Button, SignInLayout, Stack, Text, useAnnounce } from "@ampm/ui";

import { EnrollForm, RecoveryCodesForm } from "./authenticator-forms";
import { ClientCodeStep } from "./client-code-step";
import { InlineAlert } from "./inline-alert";
import { SignInHero } from "./sign-in-hero";
import { NewPasswordForm } from "./staff-sign-in-forms";
import { useAmpmActivation, type AmpmActivation } from "./use-ampm-activation";
import { useAmpmClientActivation, type AmpmClientActivation } from "./use-ampm-client-activation";

/** The headline's line: staff set a password and an authenticator; a client confirms the mobile. */
const SUBTITLES = {
  staff: "You've been invited to AMPM. Set your password and authenticator, and you're in.",
  client: "You've been invited to AMPM. Confirm your mobile with a one-time code, and you're in.",
} as const;

interface NoticeProps {
  readonly text: string;
  readonly action?: ReactNode;
  /** Spoken as it appears, when it answers something the person just did. */
  readonly isAlert?: boolean;
}

/** A short notice in place of the form, with an optional way on. */
function Notice({ text, action, isAlert = false }: NoticeProps) {
  useAnnounce(text, isAlert);
  return (
    <Stack gap={4}>
      <Text
        variant="body"
        accessibilityRole={isAlert ? "alert" : undefined}
        accessibilityLiveRegion={isAlert ? "polite" : undefined}
      >
        {text}
      </Text>
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

/** The refusal behind a failed invitation, in words for the person holding the link. */
function previewFailure(message: string | undefined, isAlert = false) {
  if (message === ACTIVATION_ERRORS.alreadyActive) {
    return (
      <Notice
        text="This account is already active. Sign in instead."
        action={<SignInLink />}
        isAlert={isAlert}
      />
    );
  }
  return (
    <Notice
      text="This invitation is invalid or has expired. Ask AMPM to send you a new one."
      isAlert={isAlert}
    />
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

interface StepsProps {
  readonly token: string;
  readonly invitation: InvitationPreview;
}

/** A staff invitation (D-142): the password, the authenticator, then the recovery codes. */
function StaffActivationSteps({ token, invitation }: StepsProps) {
  const activation = useAmpmActivation(token);
  const { phase, pending, error } = activation;
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

/** A client invitation before any code: who it is for, what happens next, and the one gold action. */
function ClientActivationIntro({
  invitation,
  activation,
}: {
  readonly invitation: InvitationPreview;
  readonly activation: AmpmClientActivation;
}) {
  return (
    <Stack gap={4}>
      <Stack gap={2}>
        <Text variant="body">{`Welcome, ${invitation.name}.`}</Text>
        <Text variant="body">
          We&rsquo;ll text a 6-digit code to the mobile number AMPM has on file for you. Enter it
          here to activate your account.
        </Text>
      </Stack>
      <Button fullWidth size="lg" loading={activation.sending} onPress={activation.sendCode}>
        Send my code
      </Button>
      <InlineAlert text={activation.sendError} />
    </Stack>
  );
}

/** "+91 ••••• •3210" as a screen reader should say it: "your mobile number ending in 3210". */
function spokenMaskedPhone(masked: string): string | undefined {
  const tail = /(\d+)\s*$/.exec(masked)?.[1];
  return tail ? `your mobile number ending in ${tail}` : undefined;
}

/**
 * A client invitation (D-147): a code to the mobile AMPM has on file, then the code step, after which
 * the account is active and the session starts; no password, no authenticator, no recovery codes.
 */
function ClientActivationSteps({ token, invitation }: StepsProps) {
  const activation = useAmpmClientActivation(token);
  if (
    activation.refusal === SIGN_IN_ERRORS.noMobileOnFile ||
    activation.refusal === SIGN_IN_ERRORS.mobileInUse
  ) {
    return <Notice text={activation.refusal} isAlert />;
  }
  if (activation.refusal) return previewFailure(activation.refusal, true);
  if (!activation.sent) {
    return <ClientActivationIntro invitation={invitation} activation={activation} />;
  }
  return (
    <ClientCodeStep
      step={activation}
      sent={activation.sent}
      delivery="sms"
      destination={activation.sent.maskedPhone}
      spokenDestination={spokenMaskedPhone(activation.sent.maskedPhone)}
      verifyLabel="Verify and activate"
    />
  );
}

function ActivationCard({
  token,
  preview,
}: {
  readonly token: string | undefined;
  readonly preview: ReturnType<typeof useInvitationPreview>;
}) {
  if (!token) {
    return (
      <Notice text="This invitation link is incomplete. Open the link from your email again." />
    );
  }
  if (preview.isPending) return <Notice text="Checking your invitation…" />;
  if (preview.isError) return previewFailure(preview.error.message);
  if (preview.data.userType === "client") {
    return <ClientActivationSteps token={token} invitation={preview.data} />;
  }
  return <StaffActivationSteps token={token} invitation={preview.data} />;
}

/**
 * Account activation with AMPM's own sign-in (`EXPO_PUBLIC_IDENTITY_PROVIDER=ampm`), where the
 * invitation's link lands (`/activate?token=…`). Staff (D-142) choose a password, add the authenticator
 * from the QR code, confirm it with its first code and save the recovery codes. A client (D-147) has a
 * code sent to the mobile AMPM has on file and enters it. Only then is the account active. The sign-in
 * screen's arrangement, signed out and outside both chromes.
 *
 *   <AmpmActivateScreen inviteToken={token} />
 */
export function AmpmActivateScreen({ inviteToken }: { readonly inviteToken: string | undefined }) {
  const preview = useInvitationPreview(inviteToken);
  // Until the invitation says it is a client's, the headline keeps the staff's words.
  const subtitle = preview.data?.userType === "client" ? SUBTITLES.client : SUBTITLES.staff;
  return (
    <SignInLayout
      testID="activate"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={<SignInHero headline="activate" subtitle={subtitle} />}
      cardTitle="Activate your account"
      card={<ActivationCard token={inviteToken} preview={preview} />}
      footer="Invitation only · each link works once"
    />
  );
}
