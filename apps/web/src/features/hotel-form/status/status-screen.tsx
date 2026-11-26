import { useState } from "react";

import { hotelFormStateOf, type HotelFormDraftView } from "@ampm/core";

import { ButtonLink } from "@/components/site/button-link";

import { AnswersSummary } from "../answers/answers-summary";
import { FormButton, FormNotice, QuietLine } from "../form-parts";
import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import type { HotelFormSite } from "../hotel-form-provider";
import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { LoadingStep } from "../loading-step";
import { ReverifyPage, ReverifyPanel, reverifyOf, useFocusAfterPanel } from "../reverify-panel";
import { StepShell } from "../step-shell";
import { ConsentPanel } from "./consent-panel";
import { CorrectionForm } from "./correction-form";
import { StatusCard } from "./status-card";
import { STATUS_COPY as COPY } from "./status-copy";
import { hasBeenSubmitted, takesCorrections } from "./status.form";

/** The status page's heading: where focus goes back to once a new code was entered in place. */
export const STATUS_HEADING_ID = "hf-status-heading";

const NOTHING_TO_GO_BACK_TO: readonly string[] = [];

export interface StatusScreenProps {
  readonly site: HotelFormSite;
  /** The person asked for their details to be removed and was signed out: the page says so. */
  readonly onRemoved: () => void;
}

/** The way back to the overview (when the card does not already lead there), and Sign out. */
function StatusFooter({ site, draft }: StatusScreenProps & { readonly draft: HotelFormDraftView }) {
  const { flow } = site;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {hotelFormStateOf(draft.request.status) === "ready" ? null : (
        <ButtonLink href={HOTEL_FORM_ROUTES.overview} variant="secondary" size="lg">
          {COPY.back}
        </ButtonLink>
      )}
      <FormButton variant="secondary" onClick={flow.signOut} isBusy={flow.isSigningOut}>
        {flow.isSigningOut ? HOTEL_FORM_COPY.signedIn.signingOut : HOTEL_FORM_COPY.signedIn.signOut}
      </FormButton>
    </div>
  );
}

/** HF-07 once its draft is read: everything below the in-place new code, when one is asked for. */
function Status({
  site,
  draft,
  onRemoved,
}: StatusScreenProps & { readonly draft: HotelFormDraftView }) {
  const { flow, siteKey } = site;
  const identity = reverifyOf(flow);
  // Words a refused submit carried here (an earlier submit), read once as the page opens.
  const [carried] = useState(() => site.carriedNotice(HOTEL_FORM_ROUTES.status));
  const { request } = draft;
  const words = COPY.status[request.status];
  const name = flow.me.data?.person.fullName;
  useFocusAfterPanel(identity !== null, NOTHING_TO_GO_BACK_TO, STATUS_HEADING_ID);
  return (
    <StepShell
      headingId={STATUS_HEADING_ID}
      eyebrow={name === undefined ? undefined : HOTEL_FORM_COPY.signedIn.eyebrow(name)}
      title={words.title}
      emphasis={words.emphasis}
      width="form"
    >
      {identity ? <ReverifyPanel flow={flow} identity={identity} siteKey={siteKey} /> : null}
      {carried ? (
        <FormNotice notice={{ message: carried, retryAt: null, isReload: false }} />
      ) : null}
      <StatusCard request={request} />
      <AnswersSummary sections={draft.sections} canEdit={false} />
      {takesCorrections(request.status) ? <CorrectionForm site={site} /> : null}
      {hasBeenSubmitted(request) ? (
        <ConsentPanel site={site} onRemoved={onRemoved} />
      ) : (
        <QuietLine>{COPY.afterSubmit}</QuietLine>
      )}
      <StatusFooter site={site} draft={draft} onRemoved={onRemoved} />
    </StepShell>
  );
}

/**
 * HF-07, where the request stands (D-190 §5; plan §4.4, §8 and §9.3), once signed in: the reference, the
 * status in plain words, who submitted it and when, the answers read-only, "Request a correction" while
 * the answers can't be edited, and, once submitted, withdrawing 7.5 or removing your details. While the
 * draft loads, skeleton; when it could not load, why, with Try again; a refused session asks for a new
 * code in place (the page itself when there is nothing yet to keep).
 *
 *   <StatusScreen site={site} onRemoved={() => setIsRemoved(true)} />
 */
export function StatusScreen({ site, onRemoved }: StatusScreenProps) {
  const { flow, siteKey } = site;
  const identity = reverifyOf(flow);
  const draft = flow.draft.data;
  if (draft !== undefined) return <Status site={site} draft={draft} onRemoved={onRemoved} />;
  if (identity) return <ReverifyPage flow={flow} identity={identity} siteKey={siteKey} />;
  if (flow.draft.error)
    return (
      <StepShell headingId={STATUS_HEADING_ID} title={COPY.failed}>
        <FormNotice notice={{ message: flow.draft.error, retryAt: null, isReload: false }} />
        <FormButton onClick={flow.draft.retry}>{HOTEL_FORM_COPY.errors.retry}</FormButton>
      </StepShell>
    );
  return <LoadingStep label={COPY.loading} />;
}
