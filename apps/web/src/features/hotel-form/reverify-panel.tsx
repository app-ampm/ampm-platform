import { useEffect, useRef } from "react";

import { cn, glassStyles, textStyles } from "@ampm/ui/styles";

import { CODE_FIELD_ID } from "./code-form";
import type { IdentityStep } from "./flow";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { IdentityForms } from "./identity-step";
import { StepShell } from "./step-shell";
import type { HotelFormFlow } from "./use-hotel-form-flow";

const COPY = HOTEL_FORM_COPY.signedIn;

export interface ReverifyProps {
  readonly flow: HotelFormFlow;
  readonly identity: IdentityStep;
  readonly siteKey: string;
}

/** Whether a step is an SMS code's, where the code field takes focus (the phone's code autofill). */
export const isSmsCodeStep = (identity: IdentityStep): boolean =>
  identity.step === "code" && identity.issued.delivery === "sms";

/**
 * Moves focus as each of the panel's steps appears (the details, a code, a new code): to the code field
 * for an SMS code, else to the panel's heading, so a keyboard and a screen reader start at the new step
 * rather than on a button the step took away. The heading is returned for its ref.
 */
function usePanelFocus(identity: IdentityStep) {
  const heading = useRef<HTMLHeadingElement>(null);
  const isSmsCode = isSmsCodeStep(identity);
  const stepKey = identity.step === "code" ? identity.issued.challengeId : identity.step;
  useEffect(() => {
    const target = isSmsCode ? document.getElementById(CODE_FIELD_ID) : heading.current;
    target?.focus();
  }, [stepKey, isSmsCode]);
  return heading;
}

/**
 * Once the panel closes (the new code was entered), puts focus back where the person was: on the first
 * of `backIds` the page still has (Save of an open edit, a section's form), else on the page's heading.
 *
 *   useFocusAfterPanel(reverify !== null, [EDIT_SAVE_ID], REQUEST_HEADING_ID);
 */
export function useFocusAfterPanel(
  isPanelOpen: boolean,
  backIds: readonly string[],
  headingId: string,
) {
  const wasOpen = useRef(isPanelOpen);
  useEffect(() => {
    if (wasOpen.current && !isPanelOpen) {
      const back = [...backIds, headingId]
        .map((id) => document.getElementById(id))
        .find((element) => element !== null);
      back?.focus();
    }
    wasOpen.current = isPanelOpen;
  }, [isPanelOpen, backIds, headingId]);
}

/**
 * A new code asked for in place, over a signed-in page (D-189 §8): HF-02 or HF-03 in a gold panel at the
 * top, the page and what was typed on it kept below.
 *
 *   <ReverifyPanel flow={flow} identity={identity} siteKey={siteKey} />
 */
export function ReverifyPanel({ flow, identity, siteKey }: ReverifyProps) {
  const heading = usePanelFocus(identity);
  return (
    <section
      aria-labelledby="hf-reverify-heading"
      className={cn(
        glassStyles({ recipe: "gold", blur: false }),
        "flex flex-col gap-4 rounded-lg p-5",
      )}
    >
      <h2
        ref={heading}
        id="hf-reverify-heading"
        tabIndex={-1}
        className={cn(textStyles({ variant: "heading" }), "outline-none")}
      >
        {COPY.reverifyHeading}
      </h2>
      <IdentityForms flow={flow} identity={identity} siteKey={siteKey} />
    </section>
  );
}

/**
 * The new code as the page itself, while the page has nothing of its own to show yet (a session kept from
 * before a reload that had ended). A heading per step: StepShell moves focus to it as the step changes
 * (the code field takes it for an SMS code).
 *
 *   <ReverifyPage flow={flow} identity={identity} siteKey={siteKey} />
 */
export function ReverifyPage({ flow, identity, siteKey }: ReverifyProps) {
  return (
    <StepShell
      headingId={
        identity.step === "code" ? "hf-reverify-page-code-heading" : "hf-reverify-page-heading"
      }
      title={COPY.reverifyHeading}
      isFocusedOnShow={!isSmsCodeStep(identity)}
    >
      <IdentityForms flow={flow} identity={identity} siteKey={siteKey} />
    </StepShell>
  );
}

/** The identity step asked for in place, when the session was refused on a signed-in page. */
export function reverifyOf(flow: HotelFormFlow): IdentityStep | null {
  return flow.state.phase.kind === "signed_in" ? flow.state.phase.reverify : null;
}
