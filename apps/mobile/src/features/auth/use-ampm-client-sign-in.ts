import { useState } from "react";

import { useClientSignIn, useRequestClientCode } from "@ampm/api-client";
import { indianPhone, type ClientCodeSent } from "@ampm/core";

import type { CodeStep } from "./client-code-step.types";
import { refusalText } from "./refusal-text";
import { useStartSession } from "./use-start-session";

const INVALID_MOBILE = "Enter a 10-digit mobile number";
const INVALID_CODE = "Enter the 6-digit code";

/** AMPM's own client sign-in as the client card reads it: the mobile form, then the code step. */
export interface AmpmClientSignIn extends CodeStep {
  /** The mobile as typed; Change goes back to the form with it. */
  readonly phone: string;
  readonly setPhone: (value: string) => void;
  /** Something has been typed to send. */
  readonly canSend: boolean;
  /** Asks for a code for the typed mobile, once it is a number. */
  readonly sendCode: () => void;
  /** The code on its way (the code step shows), or null (the mobile form shows). */
  readonly sent: ClientCodeSent | null;
  /** Under the mobile field: not a 10-digit number, or a refusal (too many codes, offline). */
  readonly formError: string | undefined;
  readonly change: () => void;
}

/** The typed mobile, and the check made before anything is sent. */
function useMobileField() {
  const [phone, setPhone] = useState("");
  const [invalid, setInvalid] = useState(false);
  /** The number in E.164 when it is one; otherwise the field says what to type. */
  const checked = (): string | undefined => {
    const parsed = indianPhone.safeParse(phone);
    setInvalid(!parsed.success);
    return parsed.success ? parsed.data : undefined;
  };
  return { phone, setPhone, invalid, setInvalid, checked };
}

/** Asking for a code for a number, then exchanging the number and its code for a session. */
function useCodeExchange() {
  const request = useRequestClientCode();
  const signIn = useClientSignIn();
  const startSession = useStartSession();
  const [sent, setSent] = useState<ClientCodeSent | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");

  const send = (phone: string): void => {
    if (request.isPending) return;
    const onSuccess = (result: ClientCodeSent) => {
      setSent(result);
      setSentTo(phone);
      setCode("");
      signIn.reset();
    };
    request.mutate({ phone }, { onSuccess });
  };
  const confirm = (value: string): void => {
    if (!sent || value.length !== 6 || signIn.isPending) return;
    const onSuccess = (grant: { accessToken: string }) => startSession(grant.accessToken);
    signIn.mutate({ phone: sentTo, code: value }, { onSuccess });
  };
  const discard = (): void => {
    setSent(null);
    setCode("");
    request.reset();
    signIn.reset();
  };
  return {
    request,
    signIn,
    sent,
    code,
    setCode,
    send,
    resend: () => send(sentTo),
    confirm,
    discard,
  };
}

/**
 * AMPM's own client sign-in (D-147): the mobile AMPM has on file, then the 6-digit code sent to it by
 * SMS (and shown on screen while SMS delivery is not live). There is no sign-up (A-13): a number with no
 * client gets the same answer, without a code. A refusal to send shows on the form, or under "Send a new
 * code" once the code step is open; a wrong or expired code shows under the boxes. The token becomes the
 * session only when the code is accepted. Change goes back to the form, keeping the number.
 *
 *   const signIn = useAmpmClientSignIn(); // <ClientSignInCard signIn={signIn} />
 */
export function useAmpmClientSignIn(): AmpmClientSignIn {
  const field = useMobileField();
  const exchange = useCodeExchange();
  const { request, signIn } = exchange;
  return {
    phone: field.phone,
    setPhone: (value) => {
      field.setPhone(value);
      // A refusal answers the number that was sent, so editing it clears the refusal.
      field.setInvalid(false);
      if (request.error) request.reset();
    },
    canSend: field.phone.trim().length > 0,
    sendCode: () => {
      const phone = field.checked();
      if (phone) exchange.send(phone);
    },
    sent: exchange.sent,
    formError: field.invalid ? INVALID_MOBILE : refusalText(request.error, INVALID_MOBILE),
    code: exchange.code,
    setCode: exchange.setCode,
    confirm: exchange.confirm,
    resend: exchange.resend,
    change: exchange.discard,
    verifying: signIn.isPending,
    sending: request.isPending,
    codeError: refusalText(signIn.error, INVALID_CODE),
    sendError: exchange.sent ? refusalText(request.error, INVALID_MOBILE) : undefined,
  };
}
