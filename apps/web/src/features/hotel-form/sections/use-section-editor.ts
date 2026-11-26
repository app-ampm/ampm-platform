import { useEffect, useMemo, useSyncExternalStore, type FocusEvent } from "react";
import {
  hotelFormStateOf,
  type HotelFormDraftSections,
  type HotelFormDraftView,
  type HotelFormSectionKey,
} from "@ampm/core";
import { unitSelectId } from "@ampm/web-forms";

import type { HotelFormSite } from "../hotel-form-provider";
import type { HotelFormFlow } from "../use-hotel-form-flow";
import { newRowKey, type HeldSection, type HeldView } from "./held-section";
import type { HeldSections, SectionFieldsMap } from "./held-sections";
import type { SaveState } from "./section-autosave";
import type { SectionModel } from "./section-model";
import { payloadOf } from "./section-payload";
import { formSessionOf } from "./use-held-sections";

/** What every section's fields hold besides their own: the refresh note. */
export interface RefreshNote {
  readonly noLongerOffered: string;
}

/** A section page's editing state and what its fields and frame can do (D-190 §5). */
export interface SectionEditor<F> {
  readonly fields: F;
  /** "No changes since last time" (refresh requests). */
  readonly noChanges: boolean;
  /** Submitted, in review or complete, or a save was refused as locked: nothing can change. */
  readonly isReadOnly: boolean;
  readonly save: SaveState<HotelFormSectionKey>;
  /** Why the section cannot be saved as it stands (over its cap), said on the save line. */
  readonly problem: string | null;
  /** Whether a field the person has left is refused (it keeps its saved value until corrected). */
  readonly hasMarked: boolean;
  /** A change the person made: the section saves once typing stops. */
  readonly update: (change: (fields: F) => F) => void;
  readonly setNoChanges: (isOn: boolean) => void;
  /** A field's message, once the person has left it (`always` for a list's own message). */
  readonly errorOf: (id: string, always?: boolean) => string | undefined;
  /** Leaving a field: its message may show, and the section saves at once. */
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly retry: () => void;
  readonly keepMine: () => void;
  readonly takeTheirs: () => void;
  /** A new row's key (a UUID, the row id rooms and venues keep). */
  readonly newKey: () => string;
}

/**
 * The section's held state for its page: the one the layout holds, or one opened from the draft; a page
 * open on it keeps it attached, and a drop (signed out, someone else signed in) gives the page a fresh one.
 */
function useHeldSection<K extends HotelFormSectionKey>(
  key: K,
  model: SectionModel<K, SectionFieldsMap[K]>,
  { flow, sections }: { readonly flow: HotelFormFlow; readonly sections: HeldSections },
  section: HotelFormDraftSections[K],
): HeldSection<K, SectionFieldsMap[K]> {
  useSyncExternalStore(sections.subscribe, sections.generation, sections.generation);
  const reading = useMemo(() => ({ model, check: payloadOf }), [model]);
  const opened = {
    version: section.version,
    saved: { answers: section.answers, noChanges: section.noChanges },
  };
  // The person as this render knows them: the layout's own copy of the session lags one render behind.
  const held = sections.open(key, reading, opened, formSessionOf(flow).personId);
  useEffect(() => held.readWith(reading), [held, reading]);
  useEffect(() => {
    held.attach();
    return () => held.detach();
  }, [held]);
  return held;
}

/** Whether the person has left a field (a number's unit list counts for its number). */
const isTouchedIn =
  <K extends HotelFormSectionKey, F>(view: HeldView<K, F>) =>
  (id: string): boolean =>
    view.touched.has(id) || view.touched.has(unitSelectId(id));

/**
 * A section page's editor (D-190 §5): the section's fields as the layout holds them (filled from the draft
 * the first time), each change read through the section's model and handed to its autosave, messages for
 * fields the person has left, and the conflict's two ways on. Leaving the page keeps all of it, so the
 * section is still saved and opens again as it was left (review fixes E1 and E4).
 *
 *   const editor = useSectionEditor("rooms", ROOMS_MODEL, site, draft);
 */
export function useSectionEditor<K extends HotelFormSectionKey>(
  key: K,
  model: SectionModel<K, SectionFieldsMap[K]>,
  site: HotelFormSite,
  draft: HotelFormDraftView,
): SectionEditor<SectionFieldsMap[K]> {
  const held = useHeldSection(key, model, site, draft.sections[key]);
  const view = useSyncExternalStore(held.subscribe, held.snapshot, held.snapshot);
  const built = useMemo(
    () => model.answersOf(view.fields, view.saved),
    [model, view.fields, view.saved],
  );
  const isTouched = isTouchedIn(view);
  return {
    fields: view.fields,
    noChanges: view.noChanges,
    isReadOnly: hotelFormStateOf(draft.request.status) !== "ready" || view.save.kind === "locked",
    save: view.save,
    problem: view.problem,
    hasMarked: Object.keys(built.errors).some(isTouched),
    errorOf: (id, always = false) => (always || isTouched(id) ? built.errors[id] : undefined),
    update: held.update,
    setNoChanges: held.setNoChanges,
    onBlur: (event) => held.leave(event.target.id),
    retry: held.retry,
    keepMine: held.keepMine,
    takeTheirs: held.takeTheirs,
    newKey: newRowKey,
  };
}
