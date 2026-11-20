import { useState } from "react";

import { Button, Input, OtpInput, Stack, Text } from "@ampm/ui";

const TOTP_LENGTH = 6;
/** The shortest password AMPM's own sign-in accepts (D-142). */
export const MIN_PASSWORD_LENGTH = 12;

interface FormState {
  readonly pending: boolean;
  readonly errorText: string | undefined;
}

interface CredentialsFormProps extends FormState {
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly onSubmit: (password: string) => void;
  /** Shown as "Forgot password?" under the button when given (AMPM's own sign-in). */
  readonly onForgot?: (() => void) | undefined;
}

/** The work email and password: the first step of a staff sign-in. */
export function CredentialsForm(props: CredentialsFormProps) {
  const { email, setEmail, onSubmit, pending, errorText, onForgot } = props;
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
        placeholder="name@ampmverse.com"
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
      {onForgot ? (
        <Button variant="ghost" onPress={onForgot}>
          Forgot password?
        </Button>
      ) : null}
    </Stack>
  );
}

interface CodeFormProps extends FormState {
  readonly label: string;
  readonly cta: string;
  readonly onSubmit: (code: string) => void;
  /** Offers a recovery code instead, when given (AMPM's own sign-in). */
  readonly onUseRecoveryCode?: (() => void) | undefined;
}

/** A six-digit authenticator code. */
export function CodeForm({
  label,
  cta,
  onSubmit,
  pending,
  errorText,
  onUseRecoveryCode,
}: CodeFormProps) {
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
      {onUseRecoveryCode ? (
        <Button variant="ghost" onPress={onUseRecoveryCode}>
          Use a recovery code instead
        </Button>
      ) : null}
    </Stack>
  );
}

interface RecoveryCodeFormProps extends FormState {
  readonly onSubmit: (code: string) => void;
  readonly onBack: () => void;
}

/** One of the recovery codes saved at enrolment, in place of the authenticator code. */
export function RecoveryCodeForm({ onSubmit, onBack, pending, errorText }: RecoveryCodeFormProps) {
  const [code, setCode] = useState("");
  const submit = (): void => {
    onSubmit(code.trim());
  };
  return (
    <Stack gap={4}>
      <Input
        label="Recovery code"
        value={code}
        onChangeText={setCode}
        placeholder="ABCDE-23456"
        autoCapitalize="characters"
        autoComplete="off"
        errorText={errorText}
        onSubmitEditing={submit}
      />
      <Text variant="caption">Each recovery code works once.</Text>
      <Button
        fullWidth
        size="lg"
        loading={pending}
        disabled={code.trim().length < 10}
        onPress={submit}
      >
        Verify
      </Button>
      <Button variant="ghost" onPress={onBack}>
        Use the authenticator code instead
      </Button>
    </Stack>
  );
}

interface NewPasswordFormProps extends FormState {
  readonly onSubmit: (password: string) => void;
  readonly cta?: string | undefined;
}

/** A new password: at activation, or after a reset. The minimum length is enforced on the button. */
export function NewPasswordForm({ onSubmit, pending, errorText, cta }: NewPasswordFormProps) {
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
        At least {MIN_PASSWORD_LENGTH} characters. A short sentence works well.
      </Text>
      <Button
        fullWidth
        size="lg"
        loading={pending}
        disabled={password.length < MIN_PASSWORD_LENGTH}
        onPress={submit}
      >
        {cta ?? "Set password"}
      </Button>
    </Stack>
  );
}
