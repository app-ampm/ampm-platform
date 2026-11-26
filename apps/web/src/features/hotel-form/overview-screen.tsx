import { formatDay, hotelFormStateOf, type HotelFormMe } from "@ampm/core";

import { FormButton, FormNotice, QuietLine } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { LoadingStep } from "./loading-step";
import { Helpers } from "./overview-helpers";
import { NextAction, RequestBanner, StaffNote, StatusRow } from "./overview-parts";
import { OverviewSections, QuickStart } from "./overview-sections";
import { ReverifyPage, ReverifyPanel, reverifyOf, useFocusAfterPanel } from "./reverify-panel";
import type { HeldSections } from "./sections/held-sections";
import { StepShell } from "./step-shell";
import type { HotelFormFlow } from "./use-hotel-form-flow";
import { EDIT_SAVE_ID, YourDetails } from "./your-details";

const COPY = HOTEL_FORM_COPY.signedIn;

/** The overview's heading: where focus goes back to when a new code was asked for with no edit open. */
export const OVERVIEW_HEADING_ID = "hf-request-heading";

const BACK_AFTER_PANEL = [EDIT_SAVE_ID];

export interface OverviewScreenProps {
  readonly flow: HotelFormFlow;
  readonly siteKey: string;
  /** The layout's held sections: the list says which have changes not saved yet. */
  readonly sections?: HeldSections | undefined;
}

/** HF-04 with its request: everything below the in-place new code, when one is asked for. */
function Overview({
  flow,
  me,
  siteKey,
  sections,
}: OverviewScreenProps & {
  readonly me: HotelFormMe;
}) {
  const { person, request } = me;
  const identity = reverifyOf(flow);
  const draft = flow.draft.data;
  useFocusAfterPanel(identity !== null, BACK_AFTER_PANEL, OVERVIEW_HEADING_ID);
  return (
    <StepShell
      headingId={OVERVIEW_HEADING_ID}
      eyebrow={COPY.eyebrow(person.fullName)}
      title={request.displayLabel ?? COPY.defaultTitle}
      width="form"
    >
      {identity ? <ReverifyPanel flow={flow} identity={identity} siteKey={siteKey} /> : null}
      <StatusRow status={request.status} />
      <QuietLine>{HOTEL_FORM_COPY.linkUntil(formatDay(request.expiresAt))}</QuietLine>
      <RequestBanner status={request.status} request={draft?.request} />
      {request.staffNote ? <StaffNote note={request.staffNote} /> : null}
      {hotelFormStateOf(request.status) === "ready" ? <QuickStart /> : null}
      <OverviewSections draft={flow.draft} sections={sections} />
      {draft ? <Helpers contributors={draft.contributors} /> : null}
      <YourDetails
        person={person}
        canEdit={hotelFormStateOf(request.status) !== "status_only"}
        onSave={flow.saveDetails}
      />
      <NextAction status={request.status} />
      <FormButton variant="secondary" onClick={flow.signOut} isBusy={flow.isSigningOut}>
        {flow.isSigningOut ? COPY.signingOut : COPY.signOut}
      </FormButton>
    </StepShell>
  );
}

/**
 * HF-04, the overview (D-190 §5; plan §4.4 and §8), where signing in lands: AMPM's label and note, the
 * request's status, a changes-requested or locked banner, "Quick start", the seven sections with their
 * status, who else is helping, your own details with Edit, Review and submit, and Sign out. A refused
 * session asks for a new code in place at the top, everything below kept as it was; with no request to
 * show yet, the new code is the page.
 *
 *   <OverviewScreen flow={flow} siteKey={siteKey} />
 */
export function OverviewScreen({ flow, siteKey, sections }: OverviewScreenProps) {
  const { me } = flow;
  const identity = reverifyOf(flow);
  if (me.data) return <Overview flow={flow} me={me.data} siteKey={siteKey} sections={sections} />;
  if (identity) return <ReverifyPage flow={flow} identity={identity} siteKey={siteKey} />;
  if (me.error)
    return (
      <StepShell headingId={OVERVIEW_HEADING_ID} title={COPY.defaultTitle}>
        <FormNotice notice={{ message: me.error, retryAt: null, isReload: false }} />
        <FormButton onClick={me.retry}>{HOTEL_FORM_COPY.errors.retry}</FormButton>
      </StepShell>
    );
  return <LoadingStep label={COPY.loading} />;
}
