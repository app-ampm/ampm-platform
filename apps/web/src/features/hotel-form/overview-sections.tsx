import Link from "next/link";

import {
  HOTEL_FORM_SECTION_KEYS,
  type HotelFormDraftSections,
  type HotelFormSectionKey,
} from "@ampm/core";
import {
  cn,
  flatTintStyles,
  linkLabelStyles,
  linkStyles,
  listItemStyles,
  skeletonStyles,
  textStyles,
} from "@ampm/ui/styles";

import { Chip } from "@/components/site/chip";

import { FormButton, FormNotice } from "./form-parts";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { sectionPath } from "./hotel-form-routes";
import { momentOf } from "./hotel-form-time";
import { OVERVIEW_COPY as COPY } from "./overview-copy";
import { SECTION_TITLES, SECTIONS_COPY } from "./sections-copy";
import { SECTION_TONE, doneSectionsOf, sectionStatusOf } from "./section-status";
import type { DraftView } from "./use-hotel-form-flow";

/*
 * HF-04's form (D-190 §5; plan §4.4): "Quick start" pointing to the fact sheet section, then the seven
 * sections with their status and who saved each last, each a link to its page.
 */

/** "Quick start": the fact sheet section first; its uploads arrive in Slice 9, so no upload here yet. */
export function QuickStart() {
  return (
    <section
      aria-labelledby="hf-quick-start"
      className={cn(flatTintStyles, "flex flex-col gap-2 rounded p-4")}
    >
      <h2 id="hf-quick-start" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.quickStart.heading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{COPY.quickStart.body}</p>
      <Link
        href={sectionPath("fact_sheet_media")}
        className={cn(
          linkStyles({ variant: "standalone" }),
          linkLabelStyles({ variant: "standalone" }),
        )}
      >
        {`${COPY.quickStart.link} →`}
      </Link>
    </section>
  );
}

/** Who saved a section last and when, a colleague who withdrew their consent unnamed; null if never. */
function lastSavedLine(section: HotelFormDraftSections[HotelFormSectionKey]): string | null {
  if (section.lastEditedAt === null) return null;
  const moment = momentOf(section.lastEditedAt);
  return section.lastEditedBy === null
    ? COPY.sections.lastSavedUnnamed(moment)
    : COPY.sections.lastSaved(section.lastEditedBy, moment);
}

/** One section: its title as the link, its status as a word, and who saved it last. */
function SectionRow({
  sectionKey,
  sections,
}: {
  readonly sectionKey: HotelFormSectionKey;
  readonly sections: HotelFormDraftSections;
}) {
  const section = sections[sectionKey];
  const status = sectionStatusOf(section);
  const saved = lastSavedLine(section);
  return (
    <li>
      <Link
        href={sectionPath(sectionKey)}
        className={cn(
          listItemStyles({ tone: "flat", pressable: true }),
          "flex-wrap justify-between",
        )}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className={textStyles({ variant: "label", tone: "primary" })}>
            {SECTION_TITLES[sectionKey].title}
          </span>
          {saved ? (
            <span className={textStyles({ variant: "caption", tone: "muted" })}>{saved}</span>
          ) : null}
        </span>
        <Chip tone={SECTION_TONE[status]}>{SECTIONS_COPY.status[status]}</Chip>
      </Link>
    </li>
  );
}

/** The seven sections while the draft loads: rows of skeleton, the words for screen readers. */
function SectionsLoading() {
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className={textStyles({ variant: "bodySmall", tone: "muted" })}>
        {COPY.sections.loading}
      </p>
      {HOTEL_FORM_SECTION_KEYS.map((key) => (
        <div
          key={key}
          aria-hidden
          className={cn(skeletonStyles({ shape: "text" }), "h-12 w-full")}
        />
      ))}
    </div>
  );
}

/**
 * The form's seven sections with their status, how many are done, and a way to each; while the draft
 * loads, skeleton rows; when it could not load, why, with Try again.
 *
 *   <OverviewSections draft={flow.draft} />
 */
export function OverviewSections({ draft }: { readonly draft: DraftView }) {
  if (draft.error)
    return (
      <div className="flex flex-col gap-3">
        <FormNotice notice={{ message: draft.error, retryAt: null, isReload: false }} />
        <FormButton variant="secondary" onClick={draft.retry}>
          {HOTEL_FORM_COPY.errors.retry}
        </FormButton>
      </div>
    );
  if (draft.data === undefined) return draft.isLoading ? <SectionsLoading /> : null;
  const { sections } = draft.data;
  return (
    <section aria-labelledby="hf-sections-heading" className="flex flex-col gap-3">
      <div className="flex flex-row flex-wrap items-baseline justify-between gap-2">
        <h2 id="hf-sections-heading" className={textStyles({ variant: "heading" })}>
          {COPY.sections.heading}
        </h2>
        <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>
          {COPY.sections.progress(doneSectionsOf(sections), HOTEL_FORM_SECTION_KEYS.length)}
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {HOTEL_FORM_SECTION_KEYS.map((key) => (
          <SectionRow key={key} sectionKey={key} sections={sections} />
        ))}
      </ol>
    </section>
  );
}
