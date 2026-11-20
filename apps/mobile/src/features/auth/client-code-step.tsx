import { indianPhone } from "@ampm/core";
import { Button, Card, OtpInput, Row, Stack, Text } from "@ampm/ui";

import type { CodeDelivery, CodeStep, SentCode } from "./client-code-step.types";
import { InlineAlert } from "./inline-alert";
import { formatCountdown, spokenCountdown, useResendCountdown } from "./use-resend-countdown";

const CODE_LENGTH = 6;

/** "+91 98765 43210" for an Indian mobile; any other number as it was normalised. */
export function displayMobile(phone: string): string {
  const parsed = indianPhone.safeParse(phone);
  if (!parsed.success) return phone.trim();
  const match = /^\+91(\d{5})(\d{5})$/.exec(parsed.data);
  return match ? `+91 ${match[1]} ${match[2]}` : parsed.data;
}

/** "5 minutes", "1 minute", or seconds under a minute. */
function expiryLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/** Why the code is on screen, and how long it lasts: the demo sends no SMS; production's isn't live. */
function shownCodeCaption(delivery: CodeDelivery, expiresInSeconds: number): string {
  const expiry = `It expires in ${expiryLabel(expiresInSeconds)}.`;
  return delivery === "screen"
    ? `Demo only: no SMS is sent. ${expiry}`
    : `Sent by SMS too, and shown here while SMS delivery isn't live yet. ${expiry}`;
}

export interface ClientCodeStepProps {
  readonly step: CodeStep;
  readonly sent: SentCode;
  /** By SMS (AMPM's own sign-in) or only on screen (the dev demo): it picks the wording. */
  readonly delivery: CodeDelivery;
  /**
   * Over the heading: "Signing in", "Account created for Aditi Sharma". Activation has none: its card
   * title already says what is happening.
   */
  readonly eyebrow?: string | undefined;
  /** Where the code went, as shown: "+91 98765 43210", or the activation's "+91 ••••• •3210". */
  readonly destination: string;
  /** The same, as a screen reader should say it, when the shown form reads badly (masked digits). */
  readonly spokenDestination?: string | undefined;
  /** The gold action; "Verify and sign in" unless given. */
  readonly verifyLabel?: string | undefined;
}

interface ShownCodeProps {
  readonly step: CodeStep;
  readonly code: string;
  readonly caption: string;
}

/** The code itself, large and spaced, with a tap to fill it in: the stand-in for the SMS. */
function ShownCode({ step, code, caption }: ShownCodeProps) {
  return (
    <Card tone="flat" padding="sm" testID="shown-code">
      <Stack gap={2}>
        <Text variant="eyebrow">Your one-time code</Text>
        <Row gap={3} align="center" justify="between" wrap>
          <Text
            variant="data"
            tone="primary"
            className="text-3xl tracking-widest"
            accessibilityLabel={code.split("").join(" ")}
          >
            {code}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            disabled={step.code === code || step.verifying}
            onPress={() => step.setCode(code)}
          >
            Use this code
          </Button>
        </Row>
        <Text variant="caption">{caption}</Text>
      </Stack>
    </Card>
  );
}

type CodeHeaderProps = Pick<
  ClientCodeStepProps,
  "step" | "delivery" | "eyebrow" | "destination" | "spokenDestination"
>;

/** The number with no-break spaces, so a sentence that wraps never splits it ("+91 / 98765 43210"). */
function unbroken(text: string): string {
  return text.replace(/ /g, " ");
}

/** Where the code went: the bare number in the demo (no SMS), the sentence when an SMS went out. */
function Destination({ delivery, destination, spokenDestination }: CodeHeaderProps) {
  if (delivery === "screen") {
    return (
      <Text variant="data" tone="body">
        {destination}
      </Text>
    );
  }
  return (
    <Text
      variant="bodySmall"
      tone="body"
      className="flex-1"
      accessibilityLabel={
        spokenDestination ? `We sent a 6-digit code to ${spokenDestination}` : undefined
      }
    >
      {`We sent a 6-digit code to ${unbroken(destination)}`}
    </Text>
  );
}

/** Who the code is for, where it went, and (when the number can change) the way back to change it. */
function CodeHeader(props: CodeHeaderProps) {
  const { step, eyebrow } = props;
  return (
    <Stack gap={1}>
      {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
      <Text variant="heading" accessibilityRole="header">
        Enter your code
      </Text>
      <Row gap={2} align="center" justify="between">
        <Destination {...props} />
        {step.change ? (
          <Button variant="ghost" size="sm" disabled={step.verifying} onPress={step.change}>
            Change
          </Button>
        ) : null}
      </Row>
    </Stack>
  );
}

/** "Send a new code", held back with its countdown until the API would take another request. */
function ResendButton({ step, sent }: { readonly step: CodeStep; readonly sent: SentCode }) {
  const left = useResendCountdown(sent);
  const waiting = left > 0;
  return (
    <Button
      fullWidth
      variant="ghost"
      size="md"
      loading={step.sending}
      disabled={waiting || step.verifying}
      onPress={step.resend}
      accessibilityLabel={waiting ? `Send a new code in ${spokenCountdown(left)}` : undefined}
    >
      {waiting ? `Send a new code in ${formatCountdown(left)}` : "Send a new code"}
    </Button>
  );
}

interface CodeActionsProps {
  readonly step: CodeStep;
  readonly sent: SentCode;
  readonly verifyLabel: string;
}

/** Verify (the gold action), then a fresh code once the wait is over, and why one was refused. */
function CodeActions({ step, sent, verifyLabel }: CodeActionsProps) {
  return (
    <Stack gap={2}>
      <Button
        fullWidth
        size="lg"
        loading={step.verifying}
        disabled={step.code.length !== CODE_LENGTH}
        onPress={() => step.confirm(step.code)}
      >
        {verifyLabel}
      </Button>
      <ResendButton step={step} sent={sent} />
      <InlineAlert text={step.sendError} />
    </Stack>
  );
}

/**
 * The code step after a code was sent (D1's "Enter your code"), for the dev demo, AMPM's own client
 * sign-in and a client's activation alike: where the code went, with Change when the number can
 * change; the code itself when there is one to show (the demo's, or production's while SMS delivery is
 * not live, D-147); the six boxes; Verify; and "Send a new code" once the wait the API asked for is
 * over. A full code verifies at once, whether typed, filled in from an SMS or by "Use this code".
 *
 *   <ClientCodeStep step={signIn} sent={sent} delivery="sms" eyebrow="Signing in" destination="+91 98765 43210" />
 */
export function ClientCodeStep({
  step,
  sent,
  delivery,
  verifyLabel = "Verify and sign in",
  ...header
}: ClientCodeStepProps) {
  const shown = sent.screenCode;
  const expiry = expiryLabel(sent.expiresInSeconds);
  return (
    <Stack gap={4.5} testID="client-code-step">
      <CodeHeader step={step} delivery={delivery} {...header} />
      {shown ? (
        <ShownCode
          step={step}
          code={shown}
          caption={shownCodeCaption(delivery, sent.expiresInSeconds)}
        />
      ) : null}
      <OtpInput
        value={step.code}
        onChangeText={step.setCode}
        onComplete={step.confirm}
        helpText={shown ? "Enter the 6-digit code" : `The code expires in ${expiry}.`}
        errorText={step.codeError}
        // An SMS code fills in from the keyboard's suggestion once the field has focus.
        autoFocus={delivery === "sms"}
      />
      <CodeActions step={step} sent={sent} verifyLabel={verifyLabel} />
    </Stack>
  );
}
