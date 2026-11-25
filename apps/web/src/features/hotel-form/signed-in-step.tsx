import { useEffect, useRef, type ReactNode } from "react";

import {
  formatDay,
  hotelFormStateOf,
  type HotelFormMe,
  type HotelFormRequestStatus,
} from "@ampm/core";
import { cn, flatTintStyles, glassStyles, textStyles, type StatusTone } from "@ampm/ui/styles";

import { Chip } from "@/components/site/chip";

import { CODE_FIELD_ID } from "./code-form";
import type { IdentityStep } from "./flow";
import { FormButton, FormNotice, QuietLine } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { IdentityForms } from "./identity-step";
import { LoadingStep } from "./loading-step";
import { StepShell } from "./step-shell";
import type { HotelFormFlow } from "./use-hotel-form-flow";
import { EDIT_SAVE_ID, YourDetails } from "./your-details";

const COPY = HOTEL_FORM_COPY.signedIn;

/** The signed-in page's heading: where focus goes when a new code was asked for with no edit open. */
const REQUEST_HEADING_ID = "hf-request-heading";

/** The chip each status wears (peacock-night.md §8), seen from the hotel's side; the word carries it. */
const STATUS_TONE: Readonly<Record<HotelFormRequestStatus, StatusTone>> = {
  open: "danger",
  changes_requested: "danger",
  submitted: "info",
  in_review: "warning",
  merged: "success",
};

export interface SignedInStepProps {
  readonly flow: HotelFormFlow;
  readonly siteKey: string;
}

/** Whether a step is an SMS code's, where the code field takes focus (the phone's code autofill). */
const isSmsCodeStep = (identity: IdentityStep): boolean =>
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
 * Once the panel closes (the new code was entered), puts focus back where the person was: on Save when
 * their edit is open, else on the page's heading, never on a part of the page that is gone.
 */
function useFocusAfterPanel(isPanelOpen: boolean) {
  const wasOpen = useRef(isPanelOpen);
  useEffect(() => {
    if (wasOpen.current && !isPanelOpen) {
      const back =
        document.getElementById(EDIT_SAVE_ID) ?? document.getElementById(REQUEST_HEADING_ID);
      back?.focus();
    }
    wasOpen.current = isPanelOpen;
  }, [isPanelOpen]);
}

/** A new code asked for in place, over the page: HF-02 or HF-03 in a gold panel. */
function ReverifyPanel({
  flow,
  identity,
  siteKey,
}: SignedInStepProps & {
  readonly identity: IdentityStep;
}) {
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

/** "Status" and the request's chip; the word carries the meaning. */
function StatusRow({ status }: { readonly status: HotelFormRequestStatus }) {
  return (
    <div className="flex flex-row flex-wrap items-center gap-3">
      <span className={textStyles({ variant: "label", tone: "body" })}>{COPY.statusLabel}</span>
      <Chip tone={STATUS_TONE[status]}>{COPY.status[status]}</Chip>
    </div>
  );
}

/** AMPM's note for the hotel, as staff wrote it on the request. */
function StaffNote({ note }: { readonly note: string }) {
  return (
    <section
      aria-labelledby="hf-staff-note"
      className={cn(flatTintStyles, "flex flex-col gap-1.5 rounded p-4")}
    >
      <h2 id="hf-staff-note" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.noteHeading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{note}</p>
    </section>
  );
}

/** The request as the signed-in person sees it: AMPM's label and note, the status, and their details. */
function RequestSummary({
  flow,
  me,
  reverify,
}: {
  readonly flow: HotelFormFlow;
  readonly me: HotelFormMe;
  readonly reverify: ReactNode;
}) {
  const { person, request } = me;
  useFocusAfterPanel(reverify !== null);
  return (
    <StepShell
      headingId={REQUEST_HEADING_ID}
      eyebrow={COPY.eyebrow(person.fullName)}
      title={request.displayLabel ?? COPY.defaultTitle}
    >
      {reverify}
      <StatusRow status={request.status} />
      <QuietLine>{HOTEL_FORM_COPY.linkUntil(formatDay(request.expiresAt))}</QuietLine>
      {request.staffNote ? <StaffNote note={request.staffNote} /> : null}
      <p className={textStyles({ variant: "body", tone: "body" })}>{COPY.next}</p>
      <YourDetails
        person={person}
        canEdit={hotelFormStateOf(request.status) !== "status_only"}
        onSave={flow.saveDetails}
      />
      <FormButton variant="secondary" onClick={flow.signOut} isBusy={flow.isSigningOut}>
        {flow.isSigningOut ? COPY.signingOut : COPY.signOut}
      </FormButton>
    </StepShell>
  );
}

/**
 * The signed-in page (D-189 §8; HF-04 comes in Slice 8): AMPM's label, note and status, your own name
 * and designation with Edit, and Sign out. A refused session asks for a new code in place, at the top
 * of the page, with everything below it kept as it was; with no request to show yet (a session kept from
 * before a reload that has ended), the new code is the page.
 *
 *   <SignedInStep flow={flow} siteKey={siteKey} />
 */
export function SignedInStep({ flow, siteKey }: SignedInStepProps) {
  const { me, state } = flow;
  const identity = state.phase.kind === "signed_in" ? state.phase.reverify : null;
  const reverify = identity ? (
    <ReverifyPanel flow={flow} identity={identity} siteKey={siteKey} />
  ) : null;
  if (me.data) return <RequestSummary flow={flow} me={me.data} reverify={reverify} />;
  if (identity)
    // A heading per step: StepShell moves focus to it as the step changes (the code field takes it for
    // an SMS code).
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
  if (me.error)
    return (
      <StepShell headingId={REQUEST_HEADING_ID} title={COPY.defaultTitle}>
        <FormNotice notice={{ message: me.error, retryAt: null, isReload: false }} />
        <FormButton onClick={me.retry}>{HOTEL_FORM_COPY.errors.retry}</FormButton>
      </StepShell>
    );
  return <LoadingStep label={COPY.loading} />;
}
