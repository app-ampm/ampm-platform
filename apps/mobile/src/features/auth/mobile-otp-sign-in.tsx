import { Button, Callout, Input, SegmentedControl, Stack, Text } from "@ampm/ui";

import { ClientCodeStep, displayMobile } from "./client-code-step";
import { MobileNumberField } from "./mobile-number-field";
import { useClientAccess, type ClientAccess, type ClientAccessMode } from "./use-client-access";

const ACCESS_TABS = [
  { value: "sign-in", label: "Sign in" },
  { value: "sign-up", label: "Sign up" },
] as const;

const ACCESS_COPY: Record<ClientAccessMode, { title: string; lead: string; action: string }> = {
  "sign-in": {
    title: "Sign in with your mobile",
    lead: "Use the number AMPM has on file. Your one-time code appears on screen, as the demo sends no SMS.",
    action: "Send code",
  },
  "sign-up": {
    title: "Create a client account",
    lead: "Your name, then your mobile. Your sign-in code appears right here.",
    action: "Sign up",
  },
};

const SWITCH_LABEL: Record<ClientAccessMode, string> = {
  "sign-in": "Sign in instead",
  "sign-up": "Sign up instead",
};

function isAccessMode(value: string): value is ClientAccessMode {
  return value === "sign-in" || value === "sign-up";
}

/** "No client uses this number yet." with the tab that fits it, keeping the typed mobile. */
function SwitchPrompt({ access }: { readonly access: ClientAccess }) {
  const target = access.formError?.switchTo;
  if (!access.formError || !target) return null;
  return (
    <Callout
      kind="info"
      blur={false}
      title={access.formError.text}
      action={{ label: SWITCH_LABEL[target], onPress: () => access.switchMode(target) }}
      testID="client-access-switch"
    />
  );
}

/** The tab's title over a line saying what happens next. */
function AccessHeading({ mode }: { readonly mode: ClientAccessMode }) {
  return (
    <Stack gap={1}>
      <Text variant="heading" accessibilityRole="header">
        {ACCESS_COPY[mode].title}
      </Text>
      <Text variant="bodySmall" tone="muted">
        {ACCESS_COPY[mode].lead}
      </Text>
    </Stack>
  );
}

/** The mobile; errors without a way out sit under it, the others in the switch prompt. */
function MobileField({ access }: { readonly access: ClientAccess }) {
  return (
    <MobileNumberField
      value={access.phone}
      onChangeText={access.setPhone}
      errorText={access.formError?.switchTo ? undefined : access.formError?.text}
      onSubmitEditing={access.submit}
    />
  );
}

/** The tab's form: a name first (sign-up only), the mobile, then the one gold action. */
function AccessForm({ access }: { readonly access: ClientAccess }) {
  return (
    <Stack gap={4}>
      <AccessHeading mode={access.mode} />
      {access.mode === "sign-up" ? (
        <Input
          label="Full name"
          value={access.name}
          onChangeText={access.setName}
          placeholder="e.g. Aditi Sharma"
          leadingIcon="user"
          autoComplete="name"
          autoCapitalize="words"
        />
      ) : null}
      <MobileField access={access} />
      <SwitchPrompt access={access} />
      <Button
        fullWidth
        size="lg"
        loading={access.submitting}
        disabled={!access.canSubmit}
        onPress={access.submit}
      >
        {ACCESS_COPY[access.mode].action}
      </Button>
    </Stack>
  );
}

/**
 * The client card (demo only): a Sign in / Sign up switch over the tab's form, then the code step with
 * the one-time code on screen. Sign in takes a mobile AMPM has on file; sign up takes a name, then a
 * mobile, and creates the client. Both run on the dev-only `/auth/dev-login` rails (refused outside a
 * local, non-production config); production clients sign in with AMPM's own mobile code
 * (`ClientSignInCard`, D-147), where no one signs up. The screen holds the state (`useClientAccess`)
 * so the headline can follow the tab.
 */
export function ClientAccessCard({ access }: { readonly access: ClientAccess }) {
  if (access.sent) {
    return (
      <ClientCodeStep
        step={access}
        sent={access.sent}
        delivery="screen"
        eyebrow={
          access.mode === "sign-up" ? `Account created for ${access.name.trim()}` : "Signing in"
        }
        destination={displayMobile(access.phone)}
      />
    );
  }
  return (
    <Stack gap={4.5}>
      <SegmentedControl
        options={ACCESS_TABS}
        value={access.mode}
        onChange={(value) => {
          if (isAccessMode(value)) access.switchMode(value);
        }}
        fullWidth
        accessibilityLabel="Sign in or sign up"
        testID="client-access-tabs"
      />
      <AccessForm access={access} />
    </Stack>
  );
}

/** The client card holding its own state, for a screen whose headline does not follow the tab. */
export function MobileOtpSignIn() {
  return <ClientAccessCard access={useClientAccess()} />;
}
