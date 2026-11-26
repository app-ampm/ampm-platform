import { useRef, type FocusEvent, type ReactNode } from "react";

import {
  HOTEL_FORM_SECTION_KEYS,
  type HotelFormDraftView,
  type HotelFormSectionKey,
} from "@ampm/core";
import { cn, glassStyles, calloutStyles, textStyles } from "@ampm/ui/styles";
import { CheckboxField, ReadOnlyFields, TextAreaField } from "@ampm/web-forms";

import { ButtonLink } from "@/components/site/button-link";

import { QuietLine } from "../form-parts";
import { HOTEL_FORM_ROUTES, nextSectionOf, sectionPath } from "../hotel-form-routes";
import { useFocusAfterPanel } from "../reverify-panel";
import { SECTION_TITLES, SECTIONS_COPY } from "../sections-copy";
import { StepShell } from "../step-shell";
import { fieldId } from "./field-values";
import { ConflictBanner, LockedBanner, SaveLine, UnreadableBanner } from "./section-banners";
import { useFocusOnLock } from "./use-focus-on-lock";
import type { RefreshNote, SectionEditor } from "./use-section-editor";

const COPY = SECTIONS_COPY;

/** The section's heading: focus goes back to it after a choice or a new code took the place it was. */
export const SECTION_HEADING_ID = "hf-section-heading";

const focusHeading = () => document.getElementById(SECTION_HEADING_ID)?.focus();

/** Answers that no longer read, a colleague's save, a locked request, and the save line, over the questions. */
function SectionNotices<F>({
  sectionKey,
  editor,
  draft,
}: {
  readonly sectionKey: HotelFormSectionKey;
  readonly editor: SectionEditor<F>;
  readonly draft: HotelFormDraftView;
}) {
  const { save } = editor;
  return (
    <>
      {draft.sections[sectionKey].isUnreadable ? <UnreadableBanner /> : null}
      {save.kind === "conflict" ? (
        <ConflictBanner
          theirs={save.theirs}
          onKeepMine={() => {
            editor.keepMine();
            focusHeading();
          }}
          onTakeTheirs={() => {
            editor.takeTheirs();
            focusHeading();
          }}
        />
      ) : null}
      <LockedBanner refused={save.kind === "locked" ? save : null} request={draft.request} />
      {editor.isReadOnly ? null : (
        <SaveLine
          save={save}
          problem={editor.problem}
          hasMarked={editor.hasMarked}
          onRetry={editor.retry}
        />
      )}
    </>
  );
}

/** On a refresh: "No changes since last time", and the questions or why they are put away. */
function RefreshSwitch<F>({
  sectionKey,
  editor,
  children,
}: {
  readonly sectionKey: HotelFormSectionKey;
  readonly editor: SectionEditor<F>;
  readonly children: ReactNode;
}) {
  return (
    <>
      <CheckboxField
        id={fieldId(sectionKey, "noChanges")}
        label={COPY.refresh.noChanges}
        checked={editor.noChanges}
        onChange={(event) => editor.setNoChanges(event.target.checked)}
      />
      {editor.noChanges ? <QuietLine>{COPY.refresh.noChangesOn}</QuietLine> : children}
    </>
  );
}

/** "Anything no longer offered or renamed?": every section's note on a refresh. */
function NoLongerOffered<F extends RefreshNote>({
  sectionKey,
  editor,
}: {
  readonly sectionKey: HotelFormSectionKey;
  readonly editor: SectionEditor<F>;
}) {
  const id = fieldId(sectionKey, "noLongerOffered");
  return (
    <TextAreaField
      id={id}
      label={COPY.refresh.noLongerOffered}
      help={COPY.refresh.noLongerOfferedHelp}
      rows={3}
      value={editor.fields.noLongerOffered}
      onChange={(event) =>
        editor.update((fields) => ({ ...fields, noLongerOffered: event.target.value }))
      }
      error={editor.errorOf(id)}
    />
  );
}

/** Back to the overview, and on: the next section, or Review and submit after the last (the gold action). */
function SectionNav({ sectionKey }: { readonly sectionKey: HotelFormSectionKey }) {
  const next = nextSectionOf(sectionKey);
  return (
    <nav aria-label={COPY.nav.label} className="flex flex-col gap-3 md:flex-row md:justify-between">
      <ButtonLink href={HOTEL_FORM_ROUTES.overview} variant="secondary" size="lg">
        {COPY.nav.back}
      </ButtonLink>
      <ButtonLink href={next === null ? HOTEL_FORM_ROUTES.review : sectionPath(next)} size="lg">
        {next === null ? COPY.nav.review : COPY.nav.next(SECTION_TITLES[next].title)}
      </ButtonLink>
    </nav>
  );
}

/** "Fill in only what changed; blanks leave our records unchanged": a refresh request's rule. */
function RefreshLead() {
  return (
    <p
      className={cn(
        glassStyles({ recipe: "peacock", blur: false }),
        calloutStyles,
        textStyles({ variant: "bodySmall", tone: "primary" }),
      )}
    >
      {COPY.refresh.lead}
    </p>
  );
}

/**
 * The questions in one form: leaving any field saves. Read-only once the request is submitted or a save
 * was refused as locked, never disabled, so the person can still select and copy what they typed.
 */
function SectionForm<F extends RefreshNote>({
  sectionKey,
  editor,
  isRefresh,
  onLeave,
  children,
}: {
  readonly sectionKey: HotelFormSectionKey;
  readonly editor: SectionEditor<F>;
  readonly isRefresh: boolean;
  /** The field just left, for the page to remember. */
  readonly onLeave: (id: string) => void;
  readonly children: ReactNode;
}) {
  const leave = (event: FocusEvent<HTMLElement>) => {
    onLeave(event.target.id);
    editor.onBlur(event);
  };
  return (
    <form noValidate onSubmit={(event) => event.preventDefault()} onBlur={leave}>
      <fieldset className="flex min-w-0 flex-col gap-8">
        <ReadOnlyFields isReadOnly={editor.isReadOnly}>
          {isRefresh ? (
            <RefreshSwitch sectionKey={sectionKey} editor={editor}>
              {children}
            </RefreshSwitch>
          ) : (
            children
          )}
          {isRefresh ? <NoLongerOffered sectionKey={sectionKey} editor={editor} /> : null}
        </ReadOnlyFields>
      </fieldset>
    </form>
  );
}

export interface SectionScreenProps<F extends RefreshNote> {
  readonly sectionKey: HotelFormSectionKey;
  readonly draft: HotelFormDraftView;
  readonly editor: SectionEditor<F>;
  /** A new code asked for in place, over the section, when the session was refused. */
  readonly reverify: ReactNode;
  /** The section's questions. */
  readonly children: ReactNode;
}

/**
 * HF-05, a section's page (D-190 §5; plan §4.4 and §8): where it sits among the seven, its title and
 * lead, a new code in place when the session ended, a colleague's save to choose over, why a locked
 * request cannot change, the save line, then the questions. On a refresh, "Fill in only what changed",
 * "No changes since last time" and "Anything no longer offered or renamed?". Leaving any field saves the
 * section; the questions are read-only (selectable, never disabled) once the request is submitted.
 *
 *   <SectionScreen sectionKey="rooms" draft={draft} editor={editor} reverify={null}>…</SectionScreen>
 */
export function SectionScreen<F extends RefreshNote>(props: SectionScreenProps<F>) {
  const { sectionKey, draft, editor, reverify, children } = props;
  const isRefresh = draft.request.kind === "refresh";
  const place = HOTEL_FORM_SECTION_KEYS.indexOf(sectionKey) + 1;
  // The field the person left last: where focus goes back to once a new code was entered in place.
  const lastField = useRef("");
  useFocusAfterPanel(reverify !== null, [lastField.current], SECTION_HEADING_ID);
  // Turned read-only under a control that went or is disabled: focus to the locked banner's heading.
  useFocusOnLock(editor.isReadOnly, SECTION_HEADING_ID);
  return (
    <StepShell
      headingId={SECTION_HEADING_ID}
      eyebrow={COPY.eyebrow(place, HOTEL_FORM_SECTION_KEYS.length)}
      title={SECTION_TITLES[sectionKey].title}
      lead={SECTION_TITLES[sectionKey].lead}
      width="form"
    >
      {reverify}
      <SectionNotices sectionKey={sectionKey} editor={editor} draft={draft} />
      {isRefresh ? <RefreshLead /> : null}
      <SectionForm
        sectionKey={sectionKey}
        editor={editor}
        isRefresh={isRefresh}
        onLeave={(id) => {
          lastField.current = id;
        }}
      >
        {children}
      </SectionForm>
      <SectionNav sectionKey={sectionKey} />
    </StepShell>
  );
}
