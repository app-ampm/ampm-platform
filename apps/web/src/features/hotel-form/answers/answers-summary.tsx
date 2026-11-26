import Link from "next/link";

import {
  HOTEL_FORM_SECTION_KEYS,
  type HotelFormDraftSections,
  type HotelFormSectionKey,
} from "@ampm/core";
import { cn, flatTintStyles, linkLabelStyles, linkStyles, textStyles } from "@ampm/ui/styles";

import { Chip } from "@/components/site/chip";

import { sectionPath } from "../hotel-form-routes";
import { SECTION_TONE, sectionStatusOf } from "../section-status";
import { SECTION_TITLES, SECTIONS_COPY } from "../sections-copy";
import { answerLinesOf, type AnswerLine, type SectionAnswerLines } from "./answer-lines";
import { ANSWERS_COPY as COPY } from "./answers-copy";

/** The summary's heading id: the page's h2 over the seven sections. */
export const ANSWERS_HEADING_ID = "hf-answers-heading";

/** A section's heading id in the summary, which the missing items and Edit links point near. */
export const answersSectionId = (key: HotelFormSectionKey): string => `hf-answers-${key}`;

/** Questions and answers as a definition list: the question muted, the answer in pearl. */
function Lines({ lines }: { readonly lines: readonly AnswerLine[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {lines.map((line) => (
        <div key={line.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className={textStyles({ variant: "label", tone: "muted" })}>{line.label}</dt>
          <dd className={cn(textStyles({ variant: "body", tone: "primary" }), "break-words")}>
            {line.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A section's answers: its own questions, then each row under its heading, or nothing yet. */
function SectionBody({ answers }: { readonly answers: SectionAnswerLines }) {
  if (answers.lines.length === 0 && answers.groups.length === 0)
    return <p className={textStyles({ variant: "bodySmall", tone: "muted" })}>{COPY.nothingYet}</p>;
  return (
    <div className="flex flex-col gap-4">
      {answers.lines.length > 0 ? <Lines lines={answers.lines} /> : null}
      {answers.groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3 border-t border-primary/16 pt-4">
          <h4 className={textStyles({ variant: "subheading", tone: "primary" })}>
            {group.heading}
          </h4>
          <Lines lines={group.lines} />
        </div>
      ))}
    </div>
  );
}

/** Edit, named after its section for a screen reader ("Edit Rooms"). */
function EditLink({ sectionKey }: { readonly sectionKey: HotelFormSectionKey }) {
  return (
    <Link
      href={sectionPath(sectionKey)}
      className={cn(
        linkStyles({ variant: "standalone" }),
        linkLabelStyles({ variant: "standalone" }),
      )}
    >
      {COPY.edit}
      <span className="sr-only">{` ${SECTION_TITLES[sectionKey].title}`}</span>
    </Link>
  );
}

interface SectionProps {
  readonly sectionKey: HotelFormSectionKey;
  readonly sections: HotelFormDraftSections;
  readonly canEdit: boolean;
  readonly isChanged: boolean;
}

/** One section on a flat tint: its title, status and Edit, a colleague's change marked, its answers. */
function SectionAnswers({ sectionKey, sections, canEdit, isChanged }: SectionProps) {
  const section = sections[sectionKey];
  const status = sectionStatusOf(section);
  const answers: SectionAnswerLines = answerLinesOf(sectionKey, section.answers);
  const refreshNote = answers.lines.filter(
    (line) => line.label === SECTIONS_COPY.refresh.noLongerOffered,
  );
  return (
    <article
      aria-labelledby={answersSectionId(sectionKey)}
      className={cn(flatTintStyles, "flex min-w-0 flex-col gap-3 rounded p-4 md:p-5")}
    >
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <h3 id={answersSectionId(sectionKey)} className={textStyles({ variant: "heading" })}>
          {SECTION_TITLES[sectionKey].title}
        </h3>
        <div className="flex flex-row flex-wrap items-center gap-3">
          {isChanged ? <Chip tone="danger">{COPY.changed}</Chip> : null}
          <Chip tone={SECTION_TONE[status]}>{SECTIONS_COPY.status[status]}</Chip>
          {canEdit ? <EditLink sectionKey={sectionKey} /> : null}
        </div>
      </div>
      {isChanged ? (
        <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>{COPY.changedLine}</p>
      ) : null}
      {section.noChanges ? (
        <>
          <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{COPY.noChanges}</p>
          {refreshNote.length > 0 ? <Lines lines={refreshNote} /> : null}
        </>
      ) : (
        <SectionBody answers={answers} />
      )}
    </article>
  );
}

export interface AnswersSummaryProps {
  readonly sections: HotelFormDraftSections;
  /** Edit links to each section's page (HF-06, while the form takes answers); none on HF-07. */
  readonly canEdit: boolean;
  /** Sections a colleague saved after the page read them (a submit's 409 sectionsChanged), marked. */
  readonly changed?: readonly HotelFormSectionKey[] | undefined;
}

/**
 * The hotel's answers read back (D-190 §5): the seven sections in the form's order, each with its status
 * and, on HF-06, an Edit link to its page; only what was answered, a contact, room or venue under its own
 * heading. Sections a colleague changed while the person reviewed are marked.
 *
 *   <AnswersSummary sections={draft.sections} canEdit changed={["rooms"]} />
 */
export function AnswersSummary({ sections, canEdit, changed = [] }: AnswersSummaryProps) {
  return (
    <section aria-labelledby={ANSWERS_HEADING_ID} className="flex min-w-0 flex-col gap-4">
      {/* Focus comes here once the review takes a colleague's answers in (fix C1). */}
      <h2
        id={ANSWERS_HEADING_ID}
        tabIndex={-1}
        className={cn(textStyles({ variant: "heading" }), "outline-none")}
      >
        {COPY.heading}
      </h2>
      {HOTEL_FORM_SECTION_KEYS.map((key) => (
        <SectionAnswers
          key={key}
          sectionKey={key}
          sections={sections}
          canEdit={canEdit}
          isChanged={changed.includes(key)}
        />
      ))}
    </section>
  );
}
