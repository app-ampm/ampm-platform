import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useCreateDemoClient, useRequestDevOtp, useVerifyDevOtp } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Card, Input, OtpInput, Stack, Text, useToast } from "@ampm/ui";

import { setAccessToken } from "@/lib/session";

/**
 * Client sign-in by mobile + a one-time code — the demo stand-in until the SMS provider is wired
 * (SMS/OTP audit). The API returns the code and the screen shows it under the boxes; it runs on the
 * same dev-only `/auth/dev-login` rails, so there is no production path. On success it stores the local
 * token and the "/" gate routes to the client portal.
 */
function useOtpSignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const request = useRequestDevOtp();
  const verify = useVerifyDevOtp();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const sendCode = (): void => {
    const trimmed = phone.trim();
    if (trimmed.length === 0 || request.isPending) return;
    request.mutate(
      { phone: trimmed },
      {
        onSuccess: (result) => {
          setDemoCode(result.demoCode);
          setCode("");
        },
      },
    );
  };

  const verifyCode = (value: string): void => {
    if (value.length !== 6 || verify.isPending) return;
    verify.mutate(
      { phone: phone.trim(), code: value },
      {
        onSuccess: (result) => {
          setAccessToken(result.accessToken);
          // Clear (not invalidate) so a new principal never sees the previous one's cached data; the
          // "/" gate then routes by principal type.
          queryClient.clear();
          router.replace("/");
        },
      },
    );
  };

  const reset = (): void => {
    setDemoCode(null);
    setCode("");
    verify.reset();
  };

  return {
    phase: demoCode ? ("code" as const) : ("phone" as const),
    phone,
    setPhone,
    code,
    setCode,
    demoCode,
    sendCode,
    verifyCode,
    reset,
    sending: request.isPending,
    verifying: verify.isPending,
    requestError: request.isError && isAppError(request.error) ? request.error.message : undefined,
    verifyError: verify.isError && isAppError(verify.error) ? verify.error.message : undefined,
  };
}

/**
 * The optional "create a new client" step (demo only): a name plus the mobile already typed is exchanged
 * for a brand-new active client, then its first OTP is sent. The whole screen is dev-gated, so there is
 * no production path.
 */
function useNewClient(phone: string, onCreated: () => void) {
  const toast = useToast();
  const create = useCreateDemoClient();
  const [name, setName] = useState("");
  const submit = (): void => {
    if (name.trim().length === 0 || phone.trim().length === 0 || create.isPending) return;
    create.mutate(
      { name: name.trim(), phone: phone.trim() },
      {
        onSuccess: onCreated,
        onError: () => toast.show({ title: "Could not create the client", tone: "danger" }),
      },
    );
  };
  return { name, setName, submit, creating: create.isPending };
}

/** Dev-only demo tool: create a new client from a name and the mobile above, then send its first code. */
function NewClientSection({
  phone,
  onCreated,
}: {
  readonly phone: string;
  readonly onCreated: () => void;
}) {
  const c = useNewClient(phone, onCreated);
  return (
    <Stack gap={2}>
      <Text variant="eyebrow">New client? Add one (demo)</Text>
      <Input
        label="Client name"
        value={c.name}
        onChangeText={c.setName}
        placeholder="e.g. Aditi Sharma"
        onSubmitEditing={c.submit}
      />
      <Button
        fullWidth
        variant="secondary"
        size="md"
        loading={c.creating}
        disabled={c.name.trim().length === 0 || phone.trim().length === 0}
        onPress={c.submit}
      >
        Create client &amp; send code
      </Button>
    </Stack>
  );
}

/** The code step: the OTP boxes, the demo code shown underneath, and verify / start over. */
function CodeStep({ s }: { readonly s: ReturnType<typeof useOtpSignIn> }) {
  return (
    <Stack gap={3}>
      <OtpInput
        value={s.code}
        onChangeText={s.setCode}
        onComplete={s.verifyCode}
        helpText="Enter the 6-digit code"
        errorText={s.verifyError}
      />
      <Card tone="flat" padding="sm">
        <Stack gap={1}>
          <Text variant="eyebrow">Demo code — no SMS yet</Text>
          <Text variant="data" accessibilityLabel={(s.demoCode ?? "").split("").join(" ")}>
            {s.demoCode}
          </Text>
          <Text variant="caption">
            Shown here until the SMS provider is wired. Type it into the boxes above.
          </Text>
        </Stack>
      </Card>
      <Stack gap={2}>
        <Button
          fullWidth
          size="lg"
          loading={s.verifying}
          disabled={s.code.length !== 6}
          onPress={() => s.verifyCode(s.code)}
        >
          Verify &amp; sign in
        </Button>
        <Button fullWidth variant="secondary" size="md" disabled={s.verifying} onPress={s.reset}>
          Use another number
        </Button>
      </Stack>
    </Stack>
  );
}

/** Mobile number → "Send code" → the OTP boxes with the demo code shown underneath → verify & sign in. */
export function MobileOtpSignIn() {
  const s = useOtpSignIn();
  return (
    <Stack gap={4}>
      <Input
        label="Mobile number"
        value={s.phone}
        onChangeText={s.setPhone}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        disabled={s.phase === "code"}
        errorText={s.phase === "phone" ? s.requestError : undefined}
        onSubmitEditing={s.sendCode}
      />
      {s.phase === "phone" ? (
        <Stack gap={4}>
          <Button
            fullWidth
            size="lg"
            loading={s.sending}
            disabled={s.phone.trim().length === 0}
            onPress={s.sendCode}
          >
            Send code
          </Button>
          <NewClientSection phone={s.phone} onCreated={s.sendCode} />
        </Stack>
      ) : (
        <CodeStep s={s} />
      )}
    </Stack>
  );
}
