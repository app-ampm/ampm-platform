import { useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  Button,
  Card,
  Input,
  OtpInput,
  Screen,
  ScreenHeader,
  Stack,
  Text,
  useBreakpoint,
  useIsClient,
} from "@ampm/ui";

import { useStaffSignIn, type Phase, type StaffSignIn } from "./use-staff-sign-in";

const TOTP_LENGTH = 6;

const SUBTITLES: Record<Phase["kind"], string> = {
  credentials: "Sign in with your work email and password.",
  totpCode: "Enter the 6-digit code from your authenticator app.",
  newPassword: "Choose a new password to finish setting up your account.",
  enrollTotp: "Scan this with your authenticator app, then enter the code it shows.",
};

function SignInHeader({ phase }: { readonly phase: Phase["kind"] }) {
  return (
    <Stack gap={8}>
      <Text variant="wordmark">AMPM</Text>
      <ScreenHeader title="Welcome" emphasis="back." subtitle={SUBTITLES[phase]} />
    </Stack>
  );
}

interface CredentialsFormProps {
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly onSubmit: (password: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
}

function CredentialsForm({ email, setEmail, onSubmit, pending, errorText }: CredentialsFormProps) {
  const [password, setPassword] = useState("");
  const submit = (): void => {
    onSubmit(password);
  };
  const ready = email.trim().length > 0 && password.length > 0;
  return (
    <Stack gap={4}>
      <Input
        label="Work email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@ampm.example"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        errorText={errorText}
        onSubmitEditing={submit}
      />
      <Button fullWidth size="lg" loading={pending} disabled={!ready} onPress={submit}>
        Sign in
      </Button>
    </Stack>
  );
}

function CodeForm({
  label,
  cta,
  onSubmit,
  pending,
  errorText,
}: {
  readonly label: string;
  readonly cta: string;
  readonly onSubmit: (code: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
}) {
  const [code, setCode] = useState("");
  return (
    <Stack gap={4}>
      <OtpInput
        label={label}
        length={TOTP_LENGTH}
        value={code}
        onChangeText={setCode}
        errorText={errorText}
        disabled={pending}
        onComplete={onSubmit}
      />
      <Button
        fullWidth
        size="lg"
        loading={pending}
        disabled={code.length < TOTP_LENGTH}
        onPress={() => {
          onSubmit(code);
        }}
      >
        {cta}
      </Button>
    </Stack>
  );
}

function NewPasswordForm({
  onSubmit,
  pending,
  errorText,
}: {
  readonly onSubmit: (password: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
}) {
  const [password, setPassword] = useState("");
  const submit = (): void => {
    onSubmit(password);
  };
  return (
    <Stack gap={4}>
      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        errorText={errorText}
        onSubmitEditing={submit}
      />
      <Text variant="caption">
        At least 12 characters, with upper and lower case, a number and a symbol.
      </Text>
      <Button
        fullWidth
        size="lg"
        loading={pending}
        disabled={password.length < 12}
        onPress={submit}
      >
        Set password
      </Button>
    </Stack>
  );
}

function EnrollForm({
  secret,
  otpauthUri,
  onSubmit,
  pending,
  errorText,
}: {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly onSubmit: (code: string) => void;
  readonly pending: boolean;
  readonly errorText: string | undefined;
}) {
  return (
    <Stack gap={6}>
      <View className="items-center">
        <QRCode value={otpauthUri} size={180} />
      </View>
      <Stack gap={1}>
        <Text variant="caption">Can&rsquo;t scan? Enter this key in your authenticator app:</Text>
        <Text variant="mono">{secret}</Text>
      </Stack>
      <CodeForm
        label="Authenticator code"
        cta="Verify and finish"
        onSubmit={onSubmit}
        pending={pending}
        errorText={errorText}
      />
    </Stack>
  );
}

function PhaseForm({ session }: { readonly session: StaffSignIn }) {
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
        />
      );
    case "totpCode":
      return (
        <CodeForm
          label="Authenticator code"
          cta="Verify"
          onSubmit={session.submitChallenge}
          pending={pending}
          errorText={error}
        />
      );
    case "newPassword":
      return (
        <NewPasswordForm onSubmit={session.submitChallenge} pending={pending} errorText={error} />
      );
    case "enrollTotp":
      return (
        <EnrollForm
          secret={phase.secret}
          otpauthUri={phase.otpauthUri}
          onSubmit={session.confirmEnrollment}
          pending={pending}
          errorText={error}
        />
      );
  }
}

/**
 * Staff sign-in against Amazon Cognito (`EXPO_PUBLIC_IDENTITY_PROVIDER=cognito`): email + password over
 * SRP, then the authenticator-app (TOTP) challenge or, on first sign-in, enrolment. Clients sign in by
 * mobile + OTP through a separate flow. P1 on a phone; from 768 up the D1 card, centred on the canvas.
 */
export function CognitoSignInScreen() {
  const session = useStaffSignIn();
  const isClient = useIsClient();
  const { atLeast } = useBreakpoint();
  const header = <SignInHeader phase={session.phase.kind} />;

  // The server knows no window: it renders the phone layout and the client takes over after hydration.
  if (isClient && atLeast("md")) {
    return (
      <Screen glow="top" contentClassName="grow items-center justify-center">
        <Card padding="lg" className="w-full max-w-md md:p-9">
          <Stack gap={6}>
            {header}
            <PhaseForm session={session} />
          </Stack>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen glow="top" header={header}>
      <Card>
        <PhaseForm session={session} />
      </Card>
    </Screen>
  );
}
