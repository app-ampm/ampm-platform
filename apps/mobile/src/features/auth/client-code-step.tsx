import { indianPhone } from "@ampm/core";
import { Button, Card, OtpInput, Row, Stack, Text } from "@ampm/ui";

import type { ClientAccess, SentCode } from "./use-client-access";

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

/** The code itself, large and spaced, with a tap to fill it in: the demo's stand-in for the SMS. */
function DemoCode({ access, sent }: { readonly access: ClientAccess; readonly sent: SentCode }) {
  return (
    <Card tone="flat" padding="sm" testID="demo-code">
      <Stack gap={2}>
        <Text variant="eyebrow">Your one-time code</Text>
        <Row gap={3} align="center" justify="between" wrap>
          <Text
            variant="data"
            tone="primary"
            className="text-3xl tracking-widest"
            accessibilityLabel={sent.code.split("").join(" ")}
          >
            {sent.code}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            disabled={access.code === sent.code || access.verifying}
            onPress={() => access.setCode(sent.code)}
          >
            Use this code
          </Button>
        </Row>
        <Text variant="caption">
          {`Demo only: no SMS is sent. It expires in ${expiryLabel(sent.expiresInSeconds)}.`}
        </Text>
      </Stack>
    </Card>
  );
}

/** Who the code is for, and the way back to change the number. */
function CodeHeader({ access }: { readonly access: ClientAccess }) {
  const eyebrow =
    access.mode === "sign-up" ? `Account created for ${access.name.trim()}` : "Signing in";
  return (
    <Stack gap={1}>
      <Text variant="eyebrow">{eyebrow}</Text>
      <Text variant="heading" accessibilityRole="header">
        Enter your code
      </Text>
      <Row gap={2} align="center" justify="between">
        <Text variant="data" tone="body">
          {displayMobile(access.phone)}
        </Text>
        <Button variant="ghost" size="sm" disabled={access.verifying} onPress={access.change}>
          Change
        </Button>
      </Row>
    </Stack>
  );
}

/** Verify (the gold action), then a fresh code for when this one has lapsed. */
function CodeActions({ access }: { readonly access: ClientAccess }) {
  return (
    <Stack gap={2}>
      <Button
        fullWidth
        size="lg"
        loading={access.verifying}
        disabled={access.code.length !== 6}
        onPress={() => access.confirm(access.code)}
      >
        Verify and sign in
      </Button>
      <Button
        fullWidth
        variant="ghost"
        size="md"
        disabled={access.submitting || access.verifying}
        onPress={access.resend}
      >
        Send a new code
      </Button>
    </Stack>
  );
}

/**
 * The code step after Send code or Sign up (D1's "Enter your code"): the number with Change, the code
 * shown on screen (no SMS yet), the six boxes, then Verify and sign in. A full code verifies at once,
 * whether typed or filled in by "Use this code".
 */
export function ClientCodeStep({
  access,
  sent,
}: {
  readonly access: ClientAccess;
  readonly sent: SentCode;
}) {
  return (
    <Stack gap={4.5} testID="client-code-step">
      <CodeHeader access={access} />
      <DemoCode access={access} sent={sent} />
      <OtpInput
        value={access.code}
        onChangeText={access.setCode}
        onComplete={access.confirm}
        helpText="Enter the 6-digit code"
        errorText={access.codeError}
      />
      <CodeActions access={access} />
    </Stack>
  );
}
