import { useState } from "react";

import { useCreateDemoClient, useRequestDevOtp, useVerifyDevOtp } from "@ampm/api-client";
import { indianPhone, isAppError } from "@ampm/core";

import type { SentCode } from "./client-code-step.types";
import { useStartSession } from "./use-start-session";

/** Sign in with a mobile AMPM has on file, or sign up (demo only) with a name and a mobile. */
export type ClientAccessMode = "sign-in" | "sign-up";

/** A form's error, with the way out it suggests ("Sign up instead"). */
export interface AccessError {
  readonly text: string;
  readonly switchTo?: ClientAccessMode | undefined;
}

const INVALID_MOBILE: AccessError = { text: "Enter a 10-digit mobile number" };

/** A mutation's error as the form says it: absence suggests signing up, a taken number signing in. */
function accessError(error: unknown): AccessError | undefined {
  if (!isAppError(error)) return undefined;
  if (error.code === "not_found") {
    return { text: "No client uses this number yet.", switchTo: "sign-up" };
  }
  if (error.code === "conflict") {
    return { text: "A client already uses this number.", switchTo: "sign-in" };
  }
  if (error.code === "validation_failed") return INVALID_MOBILE;
  return { text: error.message };
}

/** Requesting a code for a mobile and exchanging it for a session. */
function useCodeExchange() {
  const startSession = useStartSession();
  const request = useRequestDevOtp();
  const verify = useVerifyDevOtp();
  const [sent, setSent] = useState<SentCode | null>(null);
  const [code, setCode] = useState("");

  const send = (phone: string): void => {
    if (request.isPending) return;
    // The demo's code shows on screen (no SMS), and another may be asked for at once.
    const onSuccess = (result: { demoCode: string; expiresInSeconds: number }) => {
      setSent({
        screenCode: result.demoCode,
        expiresInSeconds: result.expiresInSeconds,
        resendAfterSeconds: 0,
      });
      setCode("");
      verify.reset();
    };
    request.mutate({ phone }, { onSuccess });
  };

  const confirm = (phone: string, value: string): void => {
    if (value.length !== 6 || verify.isPending) return;
    verify.mutate(
      { phone, code: value },
      { onSuccess: (result) => startSession(result.accessToken) },
    );
  };

  const discard = (): void => {
    setSent(null);
    setCode("");
    request.reset();
    verify.reset();
  };

  return { request, verify, sent, code, setCode, send, confirm, discard };
}

type CodeExchange = ReturnType<typeof useCodeExchange>;

/** The code step's half of the card: the code sent, the boxes, verify, resend and change. */
function codeStep(exchange: CodeExchange, phone: string) {
  return {
    sent: exchange.sent,
    code: exchange.code,
    setCode: exchange.setCode,
    confirm: (value: string) => exchange.confirm(phone, value),
    resend: () => exchange.send(phone),
    change: exchange.discard,
    verifying: exchange.verify.isPending,
    sending: exchange.request.isPending,
    codeError: accessError(exchange.verify.error)?.text,
  };
}

/** The typed name and mobile, and the local checks made before anything is sent. */
function useAccessFields() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState<AccessError | undefined>(undefined);
  const validPhone = (): boolean => {
    const ok = indianPhone.safeParse(phone).success;
    setLocalError(ok ? undefined : INVALID_MOBILE);
    return ok;
  };
  return { name, setName, phone, setPhone, localError, setLocalError, validPhone };
}

/**
 * The client card's state (demo only, on the dev `/auth/dev-login` rails). "Sign in" sends a code to a
 * mobile AMPM has on file. "Sign up" creates a client from a name and a mobile, then sends its first
 * code. Either way the code step shows the code on screen, since no SMS is sent yet. Switching tabs keeps
 * the typed mobile, so "No client uses this number yet → Sign up instead" carries it across.
 */
export function useClientAccess() {
  const fields = useAccessFields();
  const exchange = useCodeExchange();
  const create = useCreateDemoClient();
  const [mode, setMode] = useState<ClientAccessMode>("sign-in");
  const phone = fields.phone.trim();
  const name = fields.name.trim();

  // An error answers what was sent, so editing the number or switching tabs clears it.
  const clearErrors = (): void => {
    fields.setLocalError(undefined);
    create.reset();
    exchange.request.reset();
  };
  const switchMode = (next: ClientAccessMode): void => {
    setMode(next);
    clearErrors();
    exchange.discard();
  };

  const canSubmit = phone.length > 0 && (mode === "sign-in" || name.length > 0);
  const submit = (): void => {
    if (!canSubmit || create.isPending || !fields.validPhone()) return;
    if (mode === "sign-in") exchange.send(phone);
    else create.mutate({ name, phone }, { onSuccess: () => exchange.send(phone) });
  };

  return {
    mode,
    switchMode,
    name: fields.name,
    setName: fields.setName,
    phone: fields.phone,
    setPhone: (value: string) => {
      fields.setPhone(value);
      clearErrors();
    },
    canSubmit,
    submit,
    submitting: create.isPending || exchange.request.isPending,
    formError: fields.localError ?? accessError(create.error ?? exchange.request.error),
    ...codeStep(exchange, phone),
  };
}

export type ClientAccess = ReturnType<typeof useClientAccess>;
