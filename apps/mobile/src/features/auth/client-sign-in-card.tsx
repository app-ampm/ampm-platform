import { Button, Stack, Text } from "@ampm/ui";

import { ClientCodeStep, displayMobile } from "./client-code-step";
import { MobileNumberField } from "./mobile-number-field";
import type { AmpmClientSignIn } from "./use-ampm-client-sign-in";

/** The first step: what happens, the mobile, then the one gold action. */
function MobileForm({ signIn }: { readonly signIn: AmpmClientSignIn }) {
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Text variant="heading" accessibilityRole="header">
          Sign in with your mobile
        </Text>
        <Text variant="bodySmall" tone="muted">
          Use the number AMPM has on file. We&rsquo;ll text you a 6-digit code.
        </Text>
      </Stack>
      <MobileNumberField
        value={signIn.phone}
        onChangeText={signIn.setPhone}
        errorText={signIn.formError}
        onSubmitEditing={signIn.sendCode}
      />
      <Button
        fullWidth
        size="lg"
        loading={signIn.sending}
        disabled={!signIn.canSend}
        onPress={signIn.sendCode}
      >
        Send code
      </Button>
    </Stack>
  );
}

/**
 * The client card of AMPM's own sign-in (D-147, AUTH-06): the mobile AMPM has on file and Send code,
 * then the code step, where the code also shows on screen while SMS delivery is not live. No sign-up
 * (A-13): AMPM sets up every client account. The screen holds the state (`useAmpmClientSignIn`), so a
 * switch to the team's sign-in and back keeps the typed number.
 *
 *   <ClientSignInCard signIn={useAmpmClientSignIn()} />
 */
export function ClientSignInCard({ signIn }: { readonly signIn: AmpmClientSignIn }) {
  if (!signIn.sent) return <MobileForm signIn={signIn} />;
  return (
    <ClientCodeStep
      step={signIn}
      sent={signIn.sent}
      delivery="sms"
      eyebrow="Signing in"
      destination={displayMobile(signIn.phone)}
    />
  );
}
