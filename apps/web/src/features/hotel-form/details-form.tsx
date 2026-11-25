import {
  HOTEL_FORM_CODE_ACTION,
  HOTEL_FORM_DESIGNATIONS,
  HOTEL_FORM_OTHER_DESIGNATION,
} from "@ampm/core";
import { CheckboxField, MobileField, SelectField, TextField } from "@ampm/web-forms";

import { BotCheckField, botCheckStatusId } from "@/components/bot-check/bot-check-field";
import { useBotCheck } from "@/components/bot-check/use-bot-check";

import type { DetailsErrors, DetailsFields } from "./details.form";
import { waitFor, type StepNotice } from "./flow";
import { FormNotice, WaitButton } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { PrivacyNoticeDisclosure } from "./privacy-notice-disclosure";
import type { BotCheckPass } from "./use-hotel-form-flow";

const COPY = HOTEL_FORM_COPY.details;

/** The bot check's widget on HF-02; its status line describes "Send me a code". */
export const DETAILS_BOT_CHECK_ID = "hf-bot-check";

const DESIGNATION_OPTIONS = HOTEL_FORM_DESIGNATIONS.map((designation) => ({
  value: designation,
  label: designation,
}));

export interface DetailsFormProps {
  readonly claim: DetailsFields;
  readonly errors: DetailsErrors;
  readonly notice: StepNotice | null;
  readonly helpContact: string | null;
  /** The Turnstile widget's site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
  readonly siteKey: string;
  readonly isSending: boolean;
  readonly onChange: (claim: DetailsFields) => void;
  readonly onSend: (botCheck: BotCheckPass) => void;
}

type FieldsProps = Pick<DetailsFormProps, "claim" | "errors" | "onChange">;

/** The designation: the list, and the words after Other. */
function DesignationFields({ claim, errors, onChange }: FieldsProps) {
  const set = (patch: Partial<DetailsFields>) => onChange({ ...claim, ...patch });
  return (
    <>
      <SelectField
        id="hf-designation"
        label={COPY.designation}
        placeholder={COPY.designationPlaceholder}
        options={DESIGNATION_OPTIONS}
        value={claim.designationChoice}
        onChange={(event) => set({ designationChoice: event.target.value })}
        required
        error={errors.designationChoice}
      />
      {claim.designationChoice === HOTEL_FORM_OTHER_DESIGNATION ? (
        <TextField
          id="hf-designation-other"
          label={COPY.designationOther}
          value={claim.designationOther}
          onChange={(event) => set({ designationOther: event.target.value })}
          required
          autoComplete="organization-title"
          help={COPY.designationOtherHelp}
          error={errors.designationOther}
        />
      ) : null}
    </>
  );
}

/** Who the person is: name, designation and mobile. */
function IdentityFields({ claim, errors, onChange }: FieldsProps) {
  const set = (patch: Partial<DetailsFields>) => onChange({ ...claim, ...patch });
  return (
    <>
      <TextField
        id="hf-full-name"
        label={COPY.fullName}
        value={claim.fullName}
        onChange={(event) => set({ fullName: event.target.value })}
        required
        autoComplete="name"
        error={errors.fullName}
      />
      <DesignationFields claim={claim} errors={errors} onChange={onChange} />
      <MobileField
        id="hf-mobile"
        label={COPY.mobile}
        value={claim.mobile}
        onChange={(event) => set({ mobile: event.target.value })}
        required
        help={COPY.mobileHelp}
        error={errors.mobile}
      />
    </>
  );
}

/** "Send me a code": waits for the bot check, counts down a code request's Retry-After, says it is sending. */
function SendButton({
  botToken,
  notice,
  isSending,
}: {
  readonly botToken: string | null;
  readonly notice: StepNotice | null;
  readonly isSending: boolean;
}) {
  return (
    <WaitButton
      type="submit"
      retryAt={waitFor(notice, "send")}
      isDisabled={botToken === null}
      isBusy={isSending}
      describedBy={botCheckStatusId(DETAILS_BOT_CHECK_ID)}
      words={COPY.send}
      busyWords={COPY.sending}
    />
  );
}

/**
 * HF-02's form (D-189 §8): the person's name, designation (Other asks for the words), Indian mobile, the
 * privacy notice's tick beside the notice itself, and Turnstile run for action `hf_code`; "Send me a
 * code" waits for the check, then the claim goes with its token. Used for the step itself and, in place,
 * for a new code once a session was refused.
 *
 *   <DetailsForm claim={state.claim} errors={state.errors} notice={state.notice} … onSend={flow.sendCode} />
 */
export function DetailsForm(props: DetailsFormProps) {
  const { claim, errors, notice, helpContact, siteKey, isSending, onChange, onSend } = props;
  const botCheck = useBotCheck(siteKey, { action: HOTEL_FORM_CODE_ACTION });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSend(botCheck);
      }}
      className="flex flex-col gap-4"
    >
      {notice ? <FormNotice notice={notice} /> : null}
      <IdentityFields claim={claim} errors={errors} onChange={onChange} />
      <CheckboxField
        id="hf-notice"
        label={COPY.notice}
        checked={claim.noticeAccepted}
        onChange={(event) => onChange({ ...claim, noticeAccepted: event.target.checked })}
        required
        error={errors.notice}
      />
      <PrivacyNoticeDisclosure helpContact={helpContact} />
      <BotCheckField
        id={DETAILS_BOT_CHECK_ID}
        copy={HOTEL_FORM_COPY.botCheck}
        check={botCheck.check}
        containerRef={botCheck.ref}
        onRetry={botCheck.reset}
      />
      <SendButton botToken={botCheck.token} notice={notice} isSending={isSending} />
    </form>
  );
}
