import { HOTEL_FORM_CODE_ACTION, formatCountdown } from "@ampm/core";
import { cn, textStyles } from "@ampm/ui/styles";
import { CodeField } from "@ampm/web-forms";

import { BotCheckField, botCheckStatusId } from "@/components/bot-check/bot-check-field";
import { useBotCheck } from "@/components/bot-check/use-bot-check";

import { spokenMobile } from "./code.form";
import { waitFor, type IdentityStep, type StepNotice } from "./flow";
import { FormButton, FormNotice, WaitButton } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { ShownCode } from "./shown-code";
import { useCountdown } from "./use-countdown";
import type { BotCheckPass } from "./use-hotel-form-flow";

const COPY = HOTEL_FORM_COPY.code;

/** The bot check's widget under "Send a new code"; its status line describes that button. */
export const RESEND_BOT_CHECK_ID = "hf-resend-check";

/** The code field's id: the field a step moves focus to for an SMS code (its autofill). */
export const CODE_FIELD_ID = "hf-code";

export interface CodeFormProps {
  readonly identity: Extract<IdentityStep, { readonly step: "code" }>;
  readonly code: string;
  readonly codeError: string | null;
  readonly notice: StepNotice | null;
  readonly siteKey: string;
  readonly isVerifying: boolean;
  readonly isSending: boolean;
  readonly onCodeChange: (code: string) => void;
  readonly onVerify: () => void;
  readonly onResend: (botCheck: BotCheckPass) => void;
  readonly onChangeDetails: () => void;
}

/** Where the code went, with Change: by SMS, or shown here for that mobile (masked). */
function Destination({
  identity,
  onChangeDetails,
  isBusy,
}: {
  readonly identity: CodeFormProps["identity"];
  readonly onChangeDetails: () => void;
  readonly isBusy: boolean;
}) {
  const { maskedMobile, delivery } = identity.issued;
  const spoken = spokenMobile(maskedMobile);
  const words = delivery === "sms" ? COPY.sentBySms : COPY.shownFor;
  return (
    <div className="flex flex-row flex-wrap items-center justify-between gap-2">
      <p className={cn(textStyles({ variant: "bodySmall", tone: "body" }), "tabular-nums")}>
        <span aria-hidden>{words(maskedMobile)}</span>
        <span className="sr-only">{words(spoken ?? maskedMobile)}</span>
      </p>
      <FormButton
        variant="ghost"
        onClick={onChangeDetails}
        isDisabled={isBusy}
        label={COPY.changeLabel}
      >
        {COPY.change}
      </FormButton>
    </div>
  );
}

/**
 * "Send a new code", held back until the API's pause (and a code request's Retry-After) is over, then its
 * bot check. A wait the API answered to a code entered holds back Continue, not this.
 */
function Resend({
  identity,
  notice,
  isSending,
  siteKey,
  onResend,
}: Pick<CodeFormProps, "identity" | "notice" | "isSending" | "siteKey" | "onResend">) {
  const botCheck = useBotCheck(siteKey, { action: HOTEL_FORM_CODE_ACTION });
  const deadline = Math.max(identity.resendAt, waitFor(notice, "send") ?? 0);
  const left = useCountdown(deadline);
  const time = formatCountdown(left);
  return (
    <div className="flex flex-col gap-3">
      <FormButton
        variant="ghost"
        onClick={() => onResend(botCheck)}
        isDisabled={left > 0 || botCheck.token === null}
        isBusy={isSending}
        describedBy={botCheckStatusId(RESEND_BOT_CHECK_ID)}
      >
        {isSending ? COPY.sending : left > 0 ? COPY.resendIn(time) : COPY.resend}
      </FormButton>
      <BotCheckField
        id={RESEND_BOT_CHECK_ID}
        copy={HOTEL_FORM_COPY.botCheck}
        check={botCheck.check}
        containerRef={botCheck.ref}
        onRetry={botCheck.reset}
      />
    </div>
  );
}

/** The code field and Continue, which a wait the API answered to a code entered counts down. */
function CodeEntry({
  identity,
  code,
  codeError,
  notice,
  isVerifying,
  onCodeChange,
  onVerify,
}: Omit<CodeFormProps, "siteKey" | "isSending" | "onResend" | "onChangeDetails">) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onVerify();
      }}
      className="flex flex-col gap-4"
    >
      <CodeField
        id={CODE_FIELD_ID}
        label={COPY.field}
        value={code}
        onChange={onCodeChange}
        required
        autoFocus={identity.issued.delivery === "sms"}
        help={COPY.lifetime}
        error={codeError ?? undefined}
      />
      <WaitButton
        type="submit"
        retryAt={waitFor(notice, "verify")}
        isBusy={isVerifying}
        words={COPY.verify}
        busyWords={COPY.verifying}
      />
    </form>
  );
}

/**
 * HF-03's form (D-189 §8): where the code went, with Change; in on-screen mode the code itself in a
 * callout with "Use this code", as client sign-in shows it (in SMS mode it is never on the page); the
 * code field; Continue; and "Send a new code" once the API's pause is over. Used for the step itself
 * and, in place, for a new code once a session was refused.
 *
 *   <CodeForm identity={identity} code={state.code} codeError={state.codeError} … onVerify={flow.verifyCode} />
 */
export function CodeForm(props: CodeFormProps) {
  const { identity, code, notice, isVerifying, onCodeChange } = props;
  const shown = identity.issued.delivery === "screen" ? identity.issued.code : null;
  return (
    <div className="flex flex-col gap-4">
      <Destination
        identity={identity}
        onChangeDetails={props.onChangeDetails}
        isBusy={isVerifying}
      />
      {shown ? (
        <ShownCode code={shown} isUsed={code === shown} onUse={() => onCodeChange(shown)} />
      ) : null}
      {notice ? <FormNotice notice={notice} /> : null}
      <CodeEntry {...props} />
      <Resend {...props} />
    </div>
  );
}
