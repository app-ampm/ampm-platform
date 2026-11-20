import { useRouter } from "expo-router";

import { SIGN_IN_ERRORS } from "@ampm/core";
import { useResetPassword } from "@ampm/api-client";
import { Button, SignInLayout, Stack, Text } from "@ampm/ui";

import { SignInHero } from "./sign-in-hero";
import { NewPasswordForm } from "./staff-sign-in-forms";

function ResetForm({ token }: { readonly token: string | undefined }) {
  const router = useRouter();
  const reset = useResetPassword();
  if (!token) {
    return (
      <Text variant="body">
        This reset link is incomplete. Open the link from your email again.
      </Text>
    );
  }
  if (reset.isSuccess) {
    return (
      <Stack gap={4}>
        <Text variant="body">
          Your password is changed and every session was signed out. Sign in with the new password
          and your authenticator code.
        </Text>
        <Button fullWidth onPress={() => router.replace("/sign-in")}>
          Go to sign-in
        </Button>
      </Stack>
    );
  }
  const expired = reset.isError && reset.error.message === SIGN_IN_ERRORS.invalidResetLink;
  return (
    <Stack gap={4}>
      <NewPasswordForm
        onSubmit={(password) => reset.mutate({ token, password })}
        pending={reset.isPending}
        errorText={reset.isError ? reset.error.message : undefined}
        cta="Change password"
      />
      {expired ? (
        <Button variant="ghost" onPress={() => router.replace("/forgot-password")}>
          Send me a new link
        </Button>
      ) : null}
    </Stack>
  );
}

/**
 * Choosing a new staff password from the emailed link (`/reset-password?token=…`, D-142). The link works
 * once, for 60 minutes; a reset signs out every session and keeps the authenticator. Signed out.
 *
 *   <ResetPasswordScreen token={token} />
 */
export function ResetPasswordScreen({ token }: { readonly token: string | undefined }) {
  return (
    <SignInLayout
      testID="reset-password"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={<SignInHero subtitle="Choose a new password for your AMPM account." />}
      cardTitle="New password"
      card={<ResetForm token={token} />}
      footer="Each link works once"
    />
  );
}
