import Link from "next/link";
import type { ReactNode } from "react";

import {
  formatCountdown,
  formatDay,
  hotelFormStateOf,
  type HotelFormDraftRequest,
  type HotelFormReadOnly,
  type HotelFormSectionConflict,
  type HotelFormSectionKey,
} from "@ampm/core";
import {
  buttonLabelStyles,
  buttonStyles,
  calloutStyles,
  cn,
  glassStyles,
  linkLabelStyles,
  linkStyles,
  textStyles,
} from "@ampm/ui/styles";

import { FormButton } from "../form-parts";
import { HOTEL_FORM_ROUTES } from "../hotel-form-routes";
import { momentOf, timeOfDay } from "../hotel-form-time";
import { OVERVIEW_COPY } from "../overview-copy";
import { submittedLine } from "../overview-parts";
import { SECTIONS_COPY } from "../sections-copy";
import { useCountdown } from "../use-countdown";
import type { SaveState } from "./section-autosave";

const COPY = SECTIONS_COPY;

/** The save line's words: Saved, Saving… or Not saved – and why; nothing to say gives the idle line. */
function saveWords(
  save: SaveState<HotelFormSectionKey>,
  problem: string | null,
  hasMarked: boolean,
  left: number,
) {
  if (problem !== null) return `${COPY.save.notSaved} ${problem}`;
  switch (save.kind) {
    case "saving":
      return COPY.save.saving;
    case "saved":
      return hasMarked ? COPY.save.fixMarked : COPY.save.saved;
    case "failed":
      return `${COPY.save.notSaved} ${save.message}`;
    case "waiting":
      return `${COPY.save.notSaved} ${save.message} ${COPY.save.retryIn(formatCountdown(left))}`;
    case "session":
      return COPY.save.session;
    case "conflict":
    case "locked":
      return COPY.save.held;
    case "idle":
      return COPY.save.idle;
  }
}

export interface SaveLineProps {
  readonly save: SaveState<HotelFormSectionKey>;
  readonly problem: string | null;
  readonly hasMarked: boolean;
  readonly onRetry: () => void;
}

/**
 * "Saved", "Saving…" or "Not saved – retry" (D-190 §5) in a polite live region, so a screen reader hears
 * each change without losing its place; Retry beside a failure, and a 429's wait counted down.
 *
 *   <SaveLine save={editor.save} problem={editor.problem} hasMarked={editor.hasMarked} onRetry={editor.retry} />
 */
export function SaveLine({ save, problem, hasMarked, onRetry }: SaveLineProps) {
  const left = useCountdown(save.kind === "waiting" ? save.retryAt : null);
  const canRetry = problem === null && save.kind === "failed";
  return (
    <div className="flex min-h-touch flex-row flex-wrap items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        className={textStyles({ variant: "bodySmall", tone: "body" })}
      >
        {saveWords(save, problem, hasMarked, left)}
      </p>
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          <span className={buttonLabelStyles({ variant: "ghost", size: "sm" })}>
            {COPY.save.retry}
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** A gold callout that is announced as it appears (role alert): something the person must decide or know. */
function AlertCallout({
  id,
  heading,
  children,
}: {
  readonly id: string;
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      role="alert"
      aria-labelledby={id}
      className={cn(glassStyles({ recipe: "gold", blur: false }), calloutStyles, "flex-col gap-3")}
    >
      <h2 id={id} className={textStyles({ variant: "label", tone: "primary" })}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

/**
 * A section whose saved answers no longer read under the form's current questions (D-190, review fix
 * D3): the draft answers it empty, so the person is asked to fill it in again; their next save replaces
 * the old answers. Announced politely, as the page opens on it.
 *
 *   {draft.sections.rooms.isUnreadable ? <UnreadableBanner /> : null}
 */
export function UnreadableBanner() {
  return (
    <section
      role="status"
      aria-labelledby="hf-unreadable-heading"
      className={cn(glassStyles({ recipe: "gold", blur: false }), calloutStyles, "flex-col gap-3")}
    >
      <h2 id="hf-unreadable-heading" className={textStyles({ variant: "label", tone: "primary" })}>
        {COPY.unreadable.heading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
        {COPY.unreadable.body}
      </p>
    </section>
  );
}

export interface ConflictBannerProps {
  readonly theirs: HotelFormSectionConflict;
  readonly onKeepMine: () => void;
  readonly onTakeTheirs: () => void;
}

/**
 * "A colleague saved this section at <time>" (D-190 §5): who saved, and the choice nothing saves until
 * the person makes. Keep mine saves this page's answers on the colleague's version; Take theirs puts the
 * colleague's answers on the page.
 *
 *   <ConflictBanner theirs={save.theirs} onKeepMine={editor.keepMine} onTakeTheirs={editor.takeTheirs} />
 */
export function ConflictBanner({ theirs, onKeepMine, onTakeTheirs }: ConflictBannerProps) {
  return (
    <AlertCallout
      id="hf-conflict-heading"
      heading={COPY.conflict.heading(timeOfDay(theirs.editedAt), formatDay(theirs.editedAt))}
    >
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
        {theirs.editedBy === null ? COPY.conflict.bodyUnnamed : COPY.conflict.body(theirs.editedBy)}
      </p>
      <div className="flex flex-row flex-wrap gap-3">
        <FormButton variant="secondary" onClick={onKeepMine}>
          {COPY.conflict.keepMine}
        </FormButton>
        <FormButton variant="secondary" onClick={onTakeTheirs}>
          {COPY.conflict.takeTheirs}
        </FormButton>
      </div>
    </AlertCallout>
  );
}

/** The way to the status page, where a correction can be asked for (HF-07). */
function StatusLink() {
  return (
    <Link
      href={HOTEL_FORM_ROUTES.status}
      className={cn(
        linkStyles({ variant: "standalone" }),
        linkLabelStyles({ variant: "standalone" }),
      )}
    >
      {`${COPY.locked.status} →`}
    </Link>
  );
}

/** Who submitted, from a refused save's details: they say who and when, which the message does not. */
function refusedLine(readOnly: HotelFormReadOnly | null): string {
  if (readOnly?.submittedBy && readOnly.submittedAt)
    return COPY.locked.refused(readOnly.submittedBy, momentOf(readOnly.submittedAt));
  return COPY.locked.refusedPlain;
}

export interface LockedBannerProps {
  /** A save refused as locked: who submitted and when; the unsaved text stays on the page. */
  readonly refused: { readonly readOnly: HotelFormReadOnly | null } | null;
  readonly request: HotelFormDraftRequest;
}

/**
 * Why the section cannot change (D-190 §5): a save refused because a colleague submitted (who and when,
 * the unsaved text kept on the page), or a request already submitted, in review or complete.
 *
 *   <LockedBanner refused={save.kind === "locked" ? save : null} request={draft.request} />
 */
export function LockedBanner({ refused, request }: LockedBannerProps) {
  if (refused !== null)
    return (
      <AlertCallout id="hf-locked-heading" heading={COPY.locked.heading}>
        <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
          {refusedLine(refused.readOnly)}
        </p>
        <StatusLink />
      </AlertCallout>
    );
  const state = hotelFormStateOf(request.status);
  if (state === "ready") return null;
  const isComplete = state === "status_only";
  return (
    <section
      aria-labelledby="hf-locked-heading"
      className={cn(
        glassStyles({ recipe: "peacock", blur: false }),
        calloutStyles,
        "flex-col gap-3",
      )}
    >
      <h2 id="hf-locked-heading" className={textStyles({ variant: "label", tone: "primary" })}>
        {isComplete ? OVERVIEW_COPY.complete.heading : OVERVIEW_COPY.locked.heading}
      </h2>
      <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
        {isComplete ? OVERVIEW_COPY.complete.body : submittedLine(request)}
      </p>
      <StatusLink />
    </section>
  );
}
