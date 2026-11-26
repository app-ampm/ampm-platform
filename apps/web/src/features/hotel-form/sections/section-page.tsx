"use client";

import type { HotelFormSectionKey } from "@ampm/core";

import { FormButton, FormNotice } from "../form-parts";
import type { HotelFormSite } from "../hotel-form-provider";
import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import { sectionPath } from "../hotel-form-routes";
import { LoadingStep } from "../loading-step";
import { ReverifyPage, ReverifyPanel, reverifyOf } from "../reverify-panel";
import { SECTION_TITLES, SECTIONS_COPY } from "../sections-copy";
import { StepShell } from "../step-shell";
import { useSignedInPage } from "../use-signed-in-page";
import { SECTION_HEADING_ID } from "./section-screen";
import { SectionHost } from "./section-hosts";
import { formSessionOf } from "./use-held-sections";

interface SectionPageProps {
  readonly sectionKey: HotelFormSectionKey;
  readonly site: HotelFormSite;
}

/**
 * The section before it can open: a new code first, the draft (or the person's `me`, which says whose
 * typing the section holds) failing with Try again, or loading.
 */
function SectionNotReady({ sectionKey, site }: SectionPageProps) {
  const { flow, siteKey } = site;
  const identity = reverifyOf(flow);
  if (identity) return <ReverifyPage flow={flow} identity={identity} siteKey={siteKey} />;
  const failed = flow.draft.data === undefined ? flow.draft : flow.me;
  if (failed.error === null) return <LoadingStep label={SECTIONS_COPY.loading} />;
  return (
    <StepShell
      headingId={SECTION_HEADING_ID}
      title={SECTION_TITLES[sectionKey].title}
      lead={SECTIONS_COPY.failed}
    >
      <FormNotice notice={{ message: failed.error, retryAt: null, isReload: false }} />
      <FormButton onClick={failed.retry}>{HOTEL_FORM_COPY.errors.retry}</FormButton>
    </StepShell>
  );
}

/**
 * The section once signed in, its draft read and its person known (what is typed in it is theirs, review
 * fix E1), with its editor; until then, why not.
 */
function SignedInSection({ sectionKey, site }: SectionPageProps) {
  const { flow, siteKey } = site;
  const identity = reverifyOf(flow);
  const draft = flow.draft.data;
  if (draft === undefined || formSessionOf(flow).personId === undefined)
    return <SectionNotReady sectionKey={sectionKey} site={site} />;
  const reverify = identity ? (
    <ReverifyPanel flow={flow} identity={identity} siteKey={siteKey} />
  ) : null;
  // Keyed by its section, so moving to another section starts that section's own fields and autosave.
  return (
    <SectionHost
      key={sectionKey}
      sectionKey={sectionKey}
      site={site}
      draft={draft}
      reverify={reverify}
    />
  );
}

/**
 * HF-05 at /hotel-form/sections/<key> (D-190 §5): the section once signed in; opened without a session,
 * the sign-in first, which comes back here.
 *
 *   <HotelFormSectionPage sectionKey="rooms" />
 */
export function HotelFormSectionPage({ sectionKey }: { readonly sectionKey: HotelFormSectionKey }) {
  const site = useSignedInPage(sectionPath(sectionKey));
  if (site === null) return <LoadingStep label={HOTEL_FORM_COPY.openingForm} />;
  return <SignedInSection sectionKey={sectionKey} site={site} />;
}
