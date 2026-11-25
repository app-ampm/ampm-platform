import { CodeForm } from "./code-form";
import { DetailsForm } from "./details-form";
import type { IdentityStep } from "./flow";
import { HelpLine } from "./form-parts";
import { HOTEL_FORM_COPY as COPY } from "./hotel-form-copy";
import { StepShell } from "./step-shell";
import type { HotelFormFlow } from "./use-hotel-form-flow";

export interface IdentityFormsProps {
  readonly flow: HotelFormFlow;
  readonly identity: IdentityStep;
  readonly siteKey: string;
}

/**
 * HF-02's or HF-03's form, wired to the flow: in the main flow, and in place over the signed-in page
 * when a session was refused (the flow keeps the details typed, so they come back filled in).
 *
 *   <IdentityForms flow={flow} identity={identity} siteKey={siteKey} />
 */
export function IdentityForms({ flow, identity, siteKey }: IdentityFormsProps) {
  const { state } = flow;
  if (identity.step === "details")
    return (
      <DetailsForm
        claim={state.claim}
        errors={state.errors}
        notice={state.notice}
        helpContact={state.helpContact}
        siteKey={siteKey}
        isSending={flow.isSendingCode}
        onChange={flow.changeClaim}
        onSend={flow.sendCode}
      />
    );
  return (
    <CodeForm
      identity={identity}
      code={state.code}
      codeError={state.codeError}
      notice={state.notice}
      siteKey={siteKey}
      isVerifying={flow.isVerifying}
      isSending={flow.isSendingCode}
      onCodeChange={flow.changeCode}
      onVerify={flow.verifyCode}
      onResend={flow.sendCode}
      onChangeDetails={flow.changeDetails}
    />
  );
}

/**
 * HF-02 (Your details, step 2 of 3) or HF-03 (Enter your code, step 3 of 3) on the step's card. In SMS
 * mode the code field takes focus, for the phone's code autofill; otherwise the new step's heading does.
 *
 *   <IdentityStepView flow={flow} identity={state.phase.identity} siteKey={siteKey} />
 */
export function IdentityStepView({ flow, identity, siteKey }: IdentityFormsProps) {
  const isDetails = identity.step === "details";
  const isSmsCode = identity.step === "code" && identity.issued.delivery === "sms";
  return (
    <StepShell
      headingId={isDetails ? "hf-details-heading" : "hf-code-heading"}
      step={isDetails ? 2 : 3}
      title={isDetails ? COPY.details.title : COPY.code.title}
      lead={isDetails ? COPY.details.lead : undefined}
      isFocusedOnShow={!isSmsCode}
    >
      <IdentityForms flow={flow} identity={identity} siteKey={siteKey} />
      <HelpLine helpContact={flow.state.helpContact} />
    </StepShell>
  );
}
