import { HOTEL_FORM_CORRECTION_ACTION, HOTEL_FORM_CORRECTION_MAX } from "@ampm/core";
import { textStyles } from "@ampm/ui/styles";
import { TextAreaField } from "@ampm/web-forms";

import { BotCheckField, botCheckStatusId } from "@/components/bot-check/bot-check-field";
import { useBotCheck, type BotCheckControl } from "@/components/bot-check/use-bot-check";

import { FocusNotice, WaitLeft } from "../focus-notice";
import { FormButton } from "../form-parts";
import type { HotelFormSite } from "../hotel-form-provider";
import { STATUS_COPY } from "./status-copy";
import { CORRECTION_FIELD_ID, useCorrection, type Correction } from "./use-correction";

const COPY = STATUS_COPY.correction;

/** The correction's bot check; its status line describes Send. */
const CORRECTION_BOT_CHECK_ID = "hf-correction-bot-check";

/** What happened to the last Send: sent in peacock, refused in gold, a wait counted down. */
function CorrectionNotice({ notice }: { readonly notice: Correction["notice"] }) {
  if (notice === null) return null;
  return (
    <FocusNotice
      id="hf-correction-notice"
      shown={notice.shown}
      message={notice.message}
      tone={notice.kind === "done" ? "peacock" : "gold"}
    >
      {notice.kind === "wait" ? <WaitLeft retryAt={notice.retryAt} words={COPY.waitLeft} /> : null}
    </FocusNotice>
  );
}

/** The message and its count, the bot check, the notice and Send. */
function CorrectionFields({
  correction,
  botCheck,
}: {
  readonly correction: Correction;
  readonly botCheck: BotCheckControl;
}) {
  return (
    <>
      <TextAreaField
        id={CORRECTION_FIELD_ID}
        label={COPY.field}
        rows={5}
        value={correction.message}
        onChange={(event) => correction.setMessage(event.target.value)}
        error={correction.error}
        help={COPY.count(correction.message.length, HOTEL_FORM_CORRECTION_MAX)}
      />
      <BotCheckField
        id={CORRECTION_BOT_CHECK_ID}
        copy={COPY.botCheck}
        check={botCheck.check}
        containerRef={botCheck.ref}
        onRetry={botCheck.reset}
      />
      <CorrectionNotice notice={correction.notice} />
      <FormButton
        type="submit"
        isBusy={correction.isSending}
        describedBy={botCheckStatusId(CORRECTION_BOT_CHECK_ID)}
      >
        {correction.isSending ? COPY.sending : COPY.send}
      </FormButton>
    </>
  );
}

/**
 * "Request a correction" (HF-07; D-190 §3 and §5): a message for AMPM's Hotel team, read only in AMPM's
 * app, with its count of characters, Turnstile for `hf_correction`, the notice of what happened, and Send,
 * disabled only while it sends. A form landmark, named by its heading.
 *
 *   <CorrectionForm site={site} />
 */
export function CorrectionForm({ site }: { readonly site: HotelFormSite }) {
  const botCheck = useBotCheck(site.siteKey, { action: HOTEL_FORM_CORRECTION_ACTION });
  const correction = useCorrection(site, botCheck);
  return (
    <form
      noValidate
      aria-labelledby="hf-correction-heading"
      onSubmit={(event) => {
        event.preventDefault();
        correction.send();
      }}
      className="flex flex-col gap-4"
    >
      <h2 id="hf-correction-heading" className={textStyles({ variant: "heading" })}>
        {COPY.heading}
      </h2>
      <p className={textStyles({ variant: "body", tone: "body" })}>{COPY.lead}</p>
      <CorrectionFields correction={correction} botCheck={botCheck} />
    </form>
  );
}
