import Link from "next/link";

import {
  type HotelFormDraftSections,
  type HotelFormMissingItem,
  type HotelFormSectionKey,
} from "@ampm/core";
import {
  calloutStyles,
  cn,
  flatTintStyles,
  glassStyles,
  linkLabelStyles,
  linkStyles,
  textStyles,
} from "@ampm/ui/styles";

import { FocusNotice, WaitLeft } from "../focus-notice";
import { FormButton } from "../form-parts";
import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import { sectionPath } from "../hotel-form-routes";
import { timeOfDay } from "../hotel-form-time";
import { SectionLinks } from "../section-links";
import { SECTION_TITLES } from "../sections-copy";
import { REVIEW_COPY as COPY } from "./review-copy";
import { missingItemWhere, type ColleagueSave } from "./review.form";
import type { ShownNotice } from "./use-review-submit";

/*
 * HF-06's notices (D-190 §5): a colleague's recent save, what is still needed before submitting (and the
 * sections not complete, which only warn), and the notice beside Submit that says why it did not go
 * through, with the way on: the sections to see to, a reload or a wait.
 */

/** The notice beside Submit: it takes focus each time it is shown. */
export const SUBMIT_NOTICE_ID = "hf-submit-notice";

const LINK_STYLES = cn(
  linkStyles({ variant: "standalone" }),
  linkLabelStyles({ variant: "standalone" }),
);
const GOLD_CALLOUT = cn(glassStyles({ recipe: "gold", blur: false }), calloutStyles, "flex-col");

/** Each item a submit needs, a link to its section saying where it is and what to do. */
function MissingItemLinks({
  items,
  sections,
}: {
  readonly items: readonly HotelFormMissingItem[];
  readonly sections: HotelFormDraftSections;
}) {
  return (
    <ul className="flex flex-col">
      {items.map((item, place) => (
        <li key={`${item.section}.${item.field ?? ""}.${place}`}>
          <Link href={sectionPath(item.section)} className={LINK_STYLES}>
            {COPY.missing.item(missingItemWhere(item, sections), item.message)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One save in words, a colleague who withdrew their consent unnamed. */
function saveLine({ section, editedBy, editedAt }: ColleagueSave): string {
  const title = SECTION_TITLES[section].title;
  const time = timeOfDay(editedAt);
  return editedBy === null
    ? COPY.colleagues.unnamed(title, time)
    : COPY.colleagues.named(editedBy, title, time);
}

/**
 * Before submitting (D-190 §5): a colleague (anyone but the person) saved some sections in the last five
 * minutes, so the person checks them first. Nothing when no one did.
 *
 *   <ColleagueWarning saves={colleagueSavesOf(draft, Date.now())} />
 */
export function ColleagueWarning({ saves }: { readonly saves: readonly ColleagueSave[] }) {
  if (saves.length === 0) return null;
  return (
    <section aria-labelledby="hf-colleagues-heading" className={cn(GOLD_CALLOUT, "gap-2")}>
      <h2 id="hf-colleagues-heading" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.colleagues.heading}
      </h2>
      <ul className="flex flex-col gap-1">
        {saves.map((save) => (
          <li key={save.section} className={textStyles({ variant: "bodySmall", tone: "primary" })}>
            {saveLine(save)}
          </li>
        ))}
      </ul>
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
        {COPY.colleagues.body}
      </p>
    </section>
  );
}

/**
 * A colleague changed sections while the page was open (D-190 §5, review fix C1): announced in a polite
 * live region (always present, so a change is heard), and shown above the answers with "Show the latest
 * answers", which takes them in. Nothing visible while nothing changed.
 *
 *   <ChangedNotice changed={changed} onShowLatest={showLatest} />
 */
export function ChangedNotice({
  changed,
  onShowLatest,
}: {
  readonly changed: readonly HotelFormSectionKey[];
  readonly onShowLatest: () => void;
}) {
  const sections = COPY.changed.sections(changed.map((key) => SECTION_TITLES[key].title));
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {changed.length > 0 ? COPY.changed.announce(sections) : ""}
      </p>
      {changed.length > 0 ? (
        <section aria-labelledby="hf-changed-heading" className={cn(GOLD_CALLOUT, "gap-3")}>
          <h2 id="hf-changed-heading" className={textStyles({ variant: "label", tone: "primary" })}>
            {COPY.changed.heading}
          </h2>
          <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
            {COPY.changed.body}
          </p>
          <FormButton variant="secondary" onClick={onShowLatest}>
            {COPY.changed.showLatest}
          </FormButton>
        </section>
      ) : null}
    </>
  );
}

export interface MissingPanelProps {
  readonly items: readonly HotelFormMissingItem[];
  /** Sections not complete: a warning only, empty sections never block a submit. */
  readonly incomplete: readonly HotelFormSectionKey[];
  readonly sections: HotelFormDraftSections;
}

/**
 * "Needed before you submit": core's missing items for the request's kind, each a link to its section,
 * or that nothing is missing; then the other sections not complete, which only warn.
 *
 *   <MissingPanel items={missingItemsOf(draft)} incomplete={incompleteSectionsOf(draft)} sections={draft.sections} />
 */
export function MissingPanel({ items, incomplete, sections }: MissingPanelProps) {
  // A section with an item above is already listed there.
  const warned = incomplete.filter((key) => !items.some((item) => item.section === key));
  return (
    <section
      aria-labelledby="hf-missing-heading"
      className={cn(flatTintStyles, "flex flex-col gap-2 rounded p-4")}
    >
      <h2 id="hf-missing-heading" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.missing.heading}
      </h2>
      {items.length === 0 ? (
        <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{COPY.missing.none}</p>
      ) : (
        <MissingItemLinks items={items} sections={sections} />
      )}
      {warned.length > 0 ? (
        <>
          <h3 className={cn(textStyles({ variant: "label", tone: "primary" }), "mt-2")}>
            {COPY.incomplete.heading}
          </h3>
          <p className={textStyles({ variant: "bodySmall", tone: "body" })}>
            {COPY.incomplete.body}
          </p>
          <SectionLinks sections={warned} />
        </>
      ) : null}
    </section>
  );
}

/** What a notice offers beyond its message: the sections or items to see to, a reload, a wait. */
function NoticeWayOn({
  notice,
  sections,
}: {
  readonly notice: ShownNotice;
  readonly sections: HotelFormDraftSections;
}) {
  switch (notice.kind) {
    case "sections_changed":
    case "pending":
      return <SectionLinks sections={notice.sections} />;
    case "incomplete":
      return <MissingItemLinks items={notice.items} sections={sections} />;
    case "reload":
      return (
        <FormButton variant="secondary" onClick={() => window.location.reload()}>
          {HOTEL_FORM_COPY.errors.reload}
        </FormButton>
      );
    case "wait":
      return <WaitLeft retryAt={notice.retryAt} words={COPY.waitLeft} />;
    default:
      return null;
  }
}

/**
 * Why Submit did not go through, beside it, in gold glass: the message (announced as it appears), then the
 * way on. It takes focus each time it is shown, a repeat included, so a keyboard and a screen reader are
 * where the answer is.
 *
 *   {submit.notice ? <SubmitNotice notice={submit.notice} sections={draft.sections} /> : null}
 */
export function SubmitNotice({
  notice,
  sections,
}: {
  readonly notice: ShownNotice;
  readonly sections: HotelFormDraftSections;
}) {
  return (
    <FocusNotice id={SUBMIT_NOTICE_ID} shown={notice.shown} message={notice.message}>
      <NoticeWayOn notice={notice} sections={sections} />
    </FocusNotice>
  );
}
