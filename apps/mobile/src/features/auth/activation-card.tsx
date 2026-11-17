import {
  announcementText,
  Button,
  Callout,
  Stack,
  Text,
  useAnnounce,
  type CalloutKind,
} from "@ampm/ui";

import type { ActivationFailure } from "./activation-outcome";
import type { AccountActivation, ActivationStep } from "./use-account-activation";

interface Notice {
  readonly title: string;
  readonly body: string;
}

/** Why an activation that can be tried again failed, said without the API's raw message (code.md). */
const FAILURE_COPY: Record<ActivationFailure, Notice> = {
  network: {
    title: "We couldn't reach AMPM",
    body: "Check your connection, then try again.",
  },
  "rate-limited": {
    title: "Too many tries",
    body: "Wait a minute, then try again.",
  },
  "email-mismatch": {
    title: "This invitation is for another email",
    body: "Sign out, sign in with the email your invitation was sent to, then open this link again.",
  },
  "linked-elsewhere": {
    title: "This sign-in belongs to another account",
    body: "Ask the person who invited you to check your invitation.",
  },
  unknown: {
    title: "Your account wasn't activated",
    body: "Something went wrong on our side. Try again in a moment.",
  },
};

type OutcomeKind = Exclude<ActivationStep["kind"], "ready">;

/** The steps that leave one way on: a notice, then its button. */
const OUTCOME_COPY: Record<
  OutcomeKind,
  Notice & { readonly kind: CalloutKind; readonly action: string }
> = {
  activated: {
    kind: "success",
    title: "Your account is active",
    body: "You're signed in. Next time, sign in from the AMPM sign-in page.",
    action: "Continue",
  },
  expired: {
    kind: "warning",
    title: "This link has expired or was already used",
    body: "Each invitation link works once, for a limited time. If you've activated already, sign in. If not, ask the person who invited you for a new link.",
    action: "Go to sign in",
  },
  "already-active": {
    kind: "info",
    title: "Your account is already active",
    body: "There's nothing left to do here. Sign in to carry on.",
    action: "Go to sign in",
  },
  "missing-link": {
    kind: "warning",
    title: "This link is incomplete",
    body: "Open the link in your invitation email again. If it still doesn't work, ask the person who invited you for a new one.",
    action: "Go to sign in",
  },
  "sign-in-first": {
    kind: "info",
    title: "Sign in first",
    body: "Sign in with the email your invitation was sent to, then open this link again to finish.",
    action: "Go to sign in",
  },
};

/** The invitation, ready to redeem; after a refusal that can be tried again, why, above the button. */
function ReadyForm({
  activation,
  failure,
}: {
  readonly activation: AccountActivation;
  readonly failure: ActivationFailure | undefined;
}) {
  return (
    <Stack gap={4}>
      <Text variant="bodySmall" tone="muted">
        Your invitation link works once. Activate it to open your AMPM account.
      </Text>
      {failure ? (
        // Danger announces itself as an alert when it appears.
        <Callout kind="danger" blur={false} title={FAILURE_COPY[failure].title}>
          {FAILURE_COPY[failure].body}
        </Callout>
      ) : null}
      <Button fullWidth size="lg" loading={activation.pending} onPress={activation.activate}>
        Activate account
      </Button>
    </Stack>
  );
}

/** A step with one way on. It replaces the button just pressed, so it is spoken when it appears. */
function OutcomeNotice({
  kind,
  activation,
}: {
  readonly kind: OutcomeKind;
  readonly activation: AccountActivation;
}) {
  const copy = OUTCOME_COPY[kind];
  useAnnounce(announcementText(copy.title, copy.body), true, { web: true });
  const onPress = kind === "activated" ? activation.continueToApp : activation.goToSignIn;
  return (
    <Stack gap={4}>
      <Callout kind={copy.kind} blur={false} title={copy.title} testID="activation-outcome">
        {copy.body}
      </Callout>
      <Button fullWidth size="lg" onPress={onPress}>
        {copy.action}
      </Button>
    </Stack>
  );
}

/**
 * What the activation card holds at each step: the one gold button to activate, or a notice saying
 * where the link leaves the person and the one way on (into the app, or to sign-in).
 */
export function ActivationCard({ activation }: { readonly activation: AccountActivation }) {
  const { step } = activation;
  return step.kind === "ready" ? (
    <ReadyForm activation={activation} failure={step.failure} />
  ) : (
    <OutcomeNotice kind={step.kind} activation={activation} />
  );
}
