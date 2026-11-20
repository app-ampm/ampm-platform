import { useRouter } from "expo-router";
import { useState } from "react";

import { useForgotPassword } from "@ampm/api-client";
import { Button, Input, SignInLayout, Stack, Text } from "@ampm/ui";

import { SignInHero } from "./sign-in-hero";

function SentNotice({ email }: { readonly email: string }) {
  const router = useRouter();
  return (
    <Stack gap={4}>
      <Text variant="body">
        If an account exists for {email}, we have emailed it a link to choose a new password. The
        link works once, for 60 minutes.
      </Text>
      <Button fullWidth onPress={() => router.replace("/sign-in")}>
        Back to sign-in
      </Button>
    </Stack>
  );
}

function RequestForm() {
  const router = useRouter();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");
  const submit = (): void => {
    if (email.trim().length > 0) forgot.mutate({ email: email.trim() });
  };
  if (forgot.isSuccess) return <SentNotice email={email.trim()} />;
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
        errorText={forgot.isError ? forgot.error.message : undefined}
        onSubmitEditing={submit}
      />
      <Button
        fullWidth
        size="lg"
        loading={forgot.isPending}
        disabled={!email.trim()}
        onPress={submit}
      >
        Email me a link
      </Button>
      <Button variant="ghost" onPress={() => router.replace("/sign-in")}>
        Back to sign-in
      </Button>
    </Stack>
  );
}

/**
 * A forgotten staff password (`/forgot-password`, D-142): the work email gets a single-use link valid for
 * 60 minutes. The answer is the same whether or not the account exists. Signed out, no chrome.
 */
export function ForgotPasswordScreen() {
  return (
    <SignInLayout
      testID="forgot-password"
      brand={<Text variant="wordmark">AMPM</Text>}
      hero={
        <SignInHero subtitle="Enter your work email and we'll send you a link to choose a new password." />
      }
      cardTitle="Forgot password"
      card={<RequestForm />}
      footer="Your authenticator stays the same"
    />
  );
}
