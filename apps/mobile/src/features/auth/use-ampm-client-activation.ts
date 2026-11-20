import { useState } from "react";

import { useConfirmClientActivation, useSendClientActivationCode } from "@ampm/api-client";
import { ACTIVATION_ERRORS, SIGN_IN_ERRORS, type ClientActivationCodeSent } from "@ampm/core";

import type { CodeStep } from "./client-code-step.types";
import { refusalText } from "./refusal-text";
import { useStartSession } from "./use-start-session";

const INVALID_CODE = "Enter the 6-digit code";
const INVALID_LINK = "This invitation link is incomplete. Open the link from your email again.";

/**
 * The refusals that end activation on this screen whatever is tried next: no usable mobile on file (none,
 * or one another client already has), or an invitation that no longer works (expired, used, or its account
 * already active).
 */
const FINAL_REFUSALS: ReadonlySet<string> = new Set([
  SIGN_IN_ERRORS.noMobileOnFile,
  SIGN_IN_ERRORS.mobileInUse,
  ACTIVATION_ERRORS.invalidInvite,
  ACTIVATION_ERRORS.inviteUsed,
  ACTIVATION_ERRORS.alreadyActive,
]);

function isFinal(message: string | undefined): message is string {
  return message !== undefined && FINAL_REFUSALS.has(message);
}

/** An invited client's activation as the activation card reads it: the first code, then the code step. */
export interface AmpmClientActivation extends CodeStep {
  /** The code on its way and the mobile it went to, masked; null until the first one is sent. */
  readonly sent: ClientActivationCodeSent | null;
  /** Sends the first code to the mobile on file. */
  readonly sendCode: () => void;
  /** A refusal that ends activation here, as the API words it (`FINAL_REFUSALS`). */
  readonly refusal: string | undefined;
}

/** Sending the invitation's code, then exchanging the invitation and the code for a session. */
function useActivationExchange(inviteToken: string) {
  const send = useSendClientActivationCode();
  const confirmation = useConfirmClientActivation();
  const startSession = useStartSession();
  const [sent, setSent] = useState<ClientActivationCodeSent | null>(null);
  const [code, setCode] = useState("");

  const sendCode = (): void => {
    if (send.isPending) return;
    const onSuccess = (result: ClientActivationCodeSent) => {
      setSent(result);
      setCode("");
      confirmation.reset();
    };
    send.mutate({ token: inviteToken }, { onSuccess });
  };
  const confirm = (value: string): void => {
    if (!sent || value.length !== 6 || confirmation.isPending) return;
    const onSuccess = (grant: { accessToken: string }) => startSession(grant.accessToken);
    confirmation.mutate({ token: inviteToken, code: value }, { onSuccess });
  };
  return { send, confirmation, sent, code, setCode, sendCode, confirm };
}

/**
 * Activating an invited client with AMPM's own sign-in (D-147): a code goes to the mobile AMPM has on
 * file, shown masked, and the code turns the account active and starts the session at once. No
 * password, no authenticator and no recovery codes: the mobile is the client's credential. A refusal
 * that can pass (too soon, offline) shows where it happened; one that ends activation (`refusal`)
 * replaces the steps.
 *
 *   const activation = useAmpmClientActivation(token); // activation.sendCode()
 */
export function useAmpmClientActivation(inviteToken: string): AmpmClientActivation {
  const exchange = useActivationExchange(inviteToken);
  const { send, confirmation } = exchange;
  const sendRefusal = refusalText(send.error, INVALID_LINK);
  const codeRefusal = refusalText(confirmation.error, INVALID_CODE);
  return {
    sent: exchange.sent,
    sendCode: exchange.sendCode,
    code: exchange.code,
    setCode: exchange.setCode,
    confirm: exchange.confirm,
    resend: exchange.sendCode,
    verifying: confirmation.isPending,
    sending: send.isPending,
    codeError: isFinal(codeRefusal) ? undefined : codeRefusal,
    sendError: isFinal(sendRefusal) ? undefined : sendRefusal,
    refusal: [sendRefusal, codeRefusal].find(isFinal),
  };
}
