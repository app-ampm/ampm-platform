import { useState } from "react";

import {
  HOTEL_FORM_SECTION_KEYS,
  type HotelFormDraftSections,
  type HotelFormDraftView,
  type HotelFormSectionKey,
} from "@ampm/core";

/*
 * What HF-06 shows and submits (D-190 §5, review fix C1): the draft as the page opened with it, so a read
 * of the draft under the page (the window regaining focus, a new code entered in place, a colleague's save
 * that a refused autosave wrote into the cache) never changes unseen what Submit declares accurate. A
 * section a colleague saved since is kept as shown and marked; the person's own later save is theirs and
 * is taken in at once; everything else follows the latest read. "Show the latest answers" takes it all in.
 */

/**
 * The sections a colleague saved since the page showed them: a different version, not the person's own
 * save, in the form's order.
 *
 * @example
 * changedSinceShown(shown, latest); // ["rooms"]
 */
export function changedSinceShown(
  shown: HotelFormDraftView,
  latest: HotelFormDraftView,
): HotelFormSectionKey[] {
  return HOTEL_FORM_SECTION_KEYS.filter((key) => {
    const section = latest.sections[key];
    return section.version !== shown.sections[key].version && !section.isLastSaveYours;
  });
}

/**
 * What the page shows once `latest` arrives: the latest read, but for each section a colleague saved since
 * the page showed it, which stays as shown until the person takes the latest answers in.
 *
 * @example
 * const next = nextShownDraft(shown, latest); // rooms kept at the version the page showed
 */
export function nextShownDraft(
  shown: HotelFormDraftView,
  latest: HotelFormDraftView,
): HotelFormDraftView {
  const sections: HotelFormDraftSections = { ...latest.sections };
  const keep = <K extends HotelFormSectionKey>(key: K) => {
    sections[key] = shown.sections[key];
  };
  changedSinceShown(shown, latest).forEach(keep);
  return { ...latest, sections };
}

/** The review's snapshot: what it shows and submits, what a colleague changed since, and the way on. */
export interface ReviewSnapshot {
  /** The draft the page shows, and whose section versions Submit sends. */
  readonly shown: HotelFormDraftView;
  /** Sections a colleague saved since the page showed them: marked, announced, kept as shown. */
  readonly changed: readonly HotelFormSectionKey[];
  /** Takes the latest read in whole: the colleague's answers shown, the marks gone. */
  readonly showLatest: () => void;
}

/** The draft shown, and the latest read it was last brought up to date with. */
interface Held {
  readonly shown: HotelFormDraftView;
  readonly seen: HotelFormDraftView;
}

/**
 * HF-06's snapshot of the draft: taken when the page opens, brought up to date with each read as
 * `nextShownDraft` says, and taken in whole on `showLatest`. 7.4 and 7.5 live elsewhere, so they are kept.
 *
 *   const snapshot = useReviewSnapshot(flow.draft.data);
 */
export function useReviewSnapshot(latest: HotelFormDraftView): ReviewSnapshot {
  const [held, setHeld] = useState<Held>({ shown: latest, seen: latest });
  let current = held;
  if (held.seen !== latest) {
    current = { shown: nextShownDraft(held.shown, latest), seen: latest };
    // Kept from this render on, as React allows a component to adjust its own state while it renders.
    setHeld(current);
  }
  return {
    shown: current.shown,
    changed: changedSinceShown(current.shown, latest),
    showLatest: () => setHeld({ shown: latest, seen: latest }),
  };
}
