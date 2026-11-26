import { useState } from "react";
import { useRequestHotelFormCorrection } from "@ampm/api-client";
import type { HotelFormCorrectionRequest } from "@ampm/core";

import type { BotCheckControl } from "@/components/bot-check/use-bot-check";

import type { HotelFormSite } from "../hotel-form-provider";
import { STATUS_COPY } from "./status-copy";
import { correctionCheckOf, pressRefusalOf } from "./status.form";
import { pressNoticeOf, usePressNotice, type ShownPressNotice } from "./use-press-notice";

const COPY = STATUS_COPY.correction;

/** The correction's text area: focus goes to it when the message needs words. */
export const CORRECTION_FIELD_ID = "hf-correction";

/** The message, its refusal, the notice beside Send, and Send. */
export interface Correction {
  readonly message: string;
  readonly error: string | undefined;
  readonly notice: ShownPressNotice | null;
  readonly isSending: boolean;
  readonly setMessage: (message: string) => void;
  readonly send: () => void;
}

/** The call: the pass spent at once, the field emptied once sent, a refusal handed on or shown. */
function useCorrectionCall(
  site: HotelFormSite,
  botCheck: BotCheckControl,
  notice: ReturnType<typeof usePressNotice>,
  setMessage: (message: string) => void,
) {
  const { mutateAsync } = useRequestHotelFormCorrection();
  const [isSending, setIsSending] = useState(false);
  const call = async (correction: HotelFormCorrectionRequest, sessionToken: string) => {
    botCheck.reset();
    setIsSending(true);
    try {
      await mutateAsync({ sessionToken, correction });
      setMessage("");
      notice.show({ kind: "done", message: COPY.sent });
    } catch (refused) {
      if (site.flow.refuseSession(refused)) return;
      const refusal = pressRefusalOf(refused);
      notice.show(
        refusal.kind === "session"
          ? { kind: "refused", message: COPY.newCode }
          : pressNoticeOf(refusal),
      );
    } finally {
      setIsSending(false);
    }
  };
  return { call, isSending };
}

/**
 * "Request a correction" on HF-07 (D-190 §3 and §5): on Send, in order, the message (some words, at most
 * 2,000 characters; focus goes to it), the bot check's pass for `hf_correction`, then the call, the pass
 * spent at once. Sent, the field empties for another and the page says so; refused, the notice gives the
 * API's words (409 notSubmitted, 429 correctionLimit held until its wait is over) and the message is kept;
 * a refused session is the flow's (a new code in place). Send is disabled only while it sends.
 *
 *   const correction = useCorrection(site, botCheck);
 */
export function useCorrection(site: HotelFormSite, botCheck: BotCheckControl): Correction {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const notice = usePressNotice();
  const { call, isSending } = useCorrectionCall(site, botCheck, notice, setMessage);
  const send = () => {
    if (isSending) return;
    if (notice.isHeld() && notice.current) return notice.show(notice.current);
    const check = correctionCheckOf(message, botCheck.token);
    setError(check.kind === "fix" ? check.error : undefined);
    if (check.kind === "fix") return document.getElementById(CORRECTION_FIELD_ID)?.focus();
    if (check.kind === "bot_check")
      return notice.show({ kind: "refused", message: COPY.waitingForCheck });
    const sessionToken = site.flow.state.session;
    if (sessionToken === null) return notice.show({ kind: "refused", message: COPY.newCode });
    void call(check.correction, sessionToken);
  };
  // Typing answers a refused message: its words give way to the count again.
  const type = (next: string) => {
    setMessage(next);
    setError(undefined);
  };
  return { message, error, notice: notice.current, isSending, setMessage: type, send };
}
