import {
  HOTEL_FORM_ACCURACY_DECLARATION as ACCURACY,
  HOTEL_FORM_DISPLAY_AUTHORISATION as DISPLAY,
  type HotelFormDraftSections,
} from "@ampm/core";
import { textStyles } from "@ampm/ui/styles";
import { CheckboxField, ChoiceSegments } from "@ampm/web-forms";

import { BotCheckField, botCheckStatusId } from "@/components/bot-check/bot-check-field";
import type { BotCheckControl } from "@/components/bot-check/use-bot-check";

import { FormButton } from "../form-parts";
import { REVIEW_COPY as COPY } from "./review-copy";
import { SubmitNotice } from "./review-notices";
import { ACCURACY_ID, DISPLAY_NAME, type ReviewSubmit } from "./use-review-submit";

/** Submit's id: focus goes back to it once a new code was entered in place. */
export const SUBMIT_ID = "hf-submit";

/** The bot check's widget on HF-06; its status line describes Submit. */
export const SUBMIT_BOT_CHECK_ID = "hf-submit-bot-check";

/** 7.5's two answers, in core's words; neither is chosen until the person chooses. */
const DISPLAY_ANSWERS = [
  { value: "yes", label: DISPLAY.yes },
  { value: "no", label: DISPLAY.no },
];

export interface ReviewDeclarationsProps {
  readonly submit: ReviewSubmit;
  readonly botCheck: BotCheckControl;
  readonly sections: HotelFormDraftSections;
}

/** 7.4's required tick and 7.5's Yes or No, each with its refusal in core's words. */
function Declarations({ submit }: { readonly submit: ReviewSubmit }) {
  const { fields, errors } = submit;
  return (
    <>
      <CheckboxField
        id={ACCURACY_ID}
        label={ACCURACY.statement}
        checked={fields.accuracyAccepted}
        onChange={(event) => submit.setAccuracy(event.target.checked)}
        required
        error={errors.accuracy}
      />
      <ChoiceSegments
        name={DISPLAY_NAME}
        legend={DISPLAY.question}
        description={[DISPLAY.ifYes, DISPLAY.ifNo]}
        options={DISPLAY_ANSWERS}
        value={fields.displayAnswer}
        onChange={(event) => submit.setDisplay(event.target.value)}
        look="soft"
        error={errors.display}
      />
    </>
  );
}

/**
 * HF-06's declarations and Submit (D-190 §2 and §5; plan §4.4): 7.4 as a required tick and 7.5 as an
 * explicit Yes or No, never pre-selected, both in core's words (a draft for counsel, HF-G2); Turnstile for
 * `hf_submit`; the notice of a refused Submit; then Submit, disabled only while it sends. A form landmark,
 * named by its heading.
 *
 *   <ReviewDeclarations submit={submit} botCheck={botCheck} sections={draft.sections} />
 */
export function ReviewDeclarations({ submit, botCheck, sections }: ReviewDeclarationsProps) {
  return (
    <form
      noValidate
      aria-labelledby="hf-declarations-heading"
      onSubmit={(event) => {
        event.preventDefault();
        submit.submit();
      }}
      className="flex flex-col gap-5"
    >
      <h2 id="hf-declarations-heading" className={textStyles({ variant: "heading" })}>
        {COPY.declarations.heading}
      </h2>
      <Declarations submit={submit} />
      <BotCheckField
        id={SUBMIT_BOT_CHECK_ID}
        copy={COPY.botCheck}
        check={botCheck.check}
        containerRef={botCheck.ref}
        onRetry={botCheck.reset}
      />
      {submit.notice ? <SubmitNotice notice={submit.notice} sections={sections} /> : null}
      <FormButton
        id={SUBMIT_ID}
        type="submit"
        isBusy={submit.isSending}
        describedBy={botCheckStatusId(SUBMIT_BOT_CHECK_ID)}
      >
        {submit.isSending ? COPY.submitting : COPY.submit}
      </FormButton>
    </form>
  );
}
