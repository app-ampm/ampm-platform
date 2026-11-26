import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { HOTEL_FORM_SUBMIT_ACTION, hotelFormStateOf, type HotelFormDraftView } from "@ampm/core";

import { useBotCheck } from "@/components/bot-check/use-bot-check";
import { ButtonLink } from "@/components/site/button-link";

import { AnswersSummary } from "../answers/answers-summary";
import { FormButton, FormNotice } from "../form-parts";
import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import type { HotelFormSite } from "../hotel-form-provider";
import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { LoadingStep } from "../loading-step";
import { ReverifyPage, ReverifyPanel, reverifyOf, useFocusAfterPanel } from "../reverify-panel";
import { StepShell } from "../step-shell";
import { REVIEW_COPY as COPY } from "./review-copy";
import { ReviewDeclarations, SUBMIT_ID } from "./review-declarations";
import { ColleagueWarning, MissingPanel } from "./review-notices";
import { colleagueSavesOf, incompleteSectionsOf, missingItemsOf } from "./review.form";
import { useReviewSubmit } from "./use-review-submit";

/** The review's heading: where focus goes back to when a new code was asked for with Submit gone. */
export const REVIEW_HEADING_ID = "hf-review-heading";

const BACK_AFTER_PANEL = [SUBMIT_ID];

/** The review once its draft is read: everything below the in-place new code, when one is asked for. */
function Review({
  site,
  draft,
}: {
  readonly site: HotelFormSite;
  readonly draft: HotelFormDraftView;
}) {
  const { flow, siteKey } = site;
  const identity = reverifyOf(flow);
  const botCheck = useBotCheck(siteKey, { action: HOTEL_FORM_SUBMIT_ACTION });
  const submit = useReviewSubmit(site, draft, botCheck);
  // When the page opened, on the API's clock (review fix C7): a colleague's save in the five minutes
  // before it is worth a warning, whatever this device's clock says.
  const [openedAt] = useState(() => Date.now());
  const apiOpenedAt = openedAt + flow.draft.clockSkewMs;
  useFocusAfterPanel(identity !== null, BACK_AFTER_PANEL, REVIEW_HEADING_ID);
  return (
    <StepShell
      headingId={REVIEW_HEADING_ID}
      eyebrow={COPY.eyebrow}
      title={COPY.title}
      emphasis={COPY.emphasis}
      lead={COPY.lead}
      width="form"
    >
      {identity ? <ReverifyPanel flow={flow} identity={identity} siteKey={siteKey} /> : null}
      <ColleagueWarning saves={colleagueSavesOf(draft, apiOpenedAt)} />
      <MissingPanel
        items={missingItemsOf(draft)}
        incomplete={incompleteSectionsOf(draft)}
        sections={draft.sections}
      />
      <AnswersSummary sections={draft.sections} canEdit changed={submit.changed} />
      <ReviewDeclarations submit={submit} botCheck={botCheck} sections={draft.sections} />
      <ButtonLink href={HOTEL_FORM_ROUTES.overview} variant="secondary" size="lg">
        {COPY.back}
      </ButtonLink>
    </StepShell>
  );
}

/**
 * Sends a request that no longer takes answers (submitted, in review, complete) to the status page: true
 * while it goes.
 */
function useLeaveWhenLocked(site: HotelFormSite): boolean {
  const router = useRouter();
  const status = site.flow.draft.data?.request.status ?? site.flow.me.data?.request.status;
  const isLeaving = status !== undefined && hotelFormStateOf(status) !== "ready";
  useEffect(() => {
    if (isLeaving) router.replace(HOTEL_FORM_ROUTES.status);
  }, [isLeaving, router]);
  return isLeaving;
}

/**
 * HF-06, Review and submit (D-190 §5; plan §4.4 and §8), once signed in: a colleague's recent save, what
 * is still needed, the answers with Edit links, 7.4 and 7.5, Turnstile and Submit. While the draft loads,
 * skeleton; when it could not load, why, with Try again; a refused session asks for a new code in place
 * (the page itself when there is nothing yet to keep). A request that no longer takes answers goes to the
 * status page.
 *
 *   <ReviewScreen site={site} />
 */
export function ReviewScreen({ site }: { readonly site: HotelFormSite }) {
  const { flow, siteKey } = site;
  const identity = reverifyOf(flow);
  const draft = flow.draft.data;
  const isLeaving = useLeaveWhenLocked(site);
  if (isLeaving) return <LoadingStep label={HOTEL_FORM_COPY.openingForm} />;
  if (draft !== undefined) return <Review site={site} draft={draft} />;
  if (identity) return <ReverifyPage flow={flow} identity={identity} siteKey={siteKey} />;
  if (flow.draft.error)
    return (
      <StepShell
        headingId={REVIEW_HEADING_ID}
        title={COPY.title}
        emphasis={COPY.emphasis}
        lead={COPY.failed}
      >
        <FormNotice notice={{ message: flow.draft.error, retryAt: null, isReload: false }} />
        <FormButton onClick={flow.draft.retry}>{HOTEL_FORM_COPY.errors.retry}</FormButton>
      </StepShell>
    );
  return <LoadingStep label={COPY.loading} />;
}
