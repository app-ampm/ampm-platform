import { useEffect, useMemo, useRef, useState, type FocusEvent, type RefObject } from "react";
import {
  hotelFormStateOf,
  type HotelFormDraftView,
  type HotelFormSectionAnswers,
  type HotelFormSectionKey,
} from "@ampm/core";
import { unitSelectId } from "@ampm/web-forms";

import type { HotelFormSite } from "../hotel-form-provider";
import type { SaveState, SectionAutosave } from "./section-autosave";
import type { SectionModel } from "./section-model";
import { payloadOf } from "./section-payload";
import { useSectionAutosave } from "./use-section-autosave";

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

interface Typed<F> {
  readonly fields: F;
  readonly noChanges: boolean;
}

const newKey = (): string => crypto.randomUUID();

/** Which fields the person has left: their messages show from then on. */
function useTouched() {
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const touch = (id: string) => {
    if (id === "") return;
    setTouched((seen) => (seen.has(id) ? seen : new Set([...seen, id])));
  };
  const isTouched = (id: string) => touched.has(id) || touched.has(unitSelectId(id));
  return { touched, touch, isTouched, reset: () => setTouched(new Set()) };
}

/** The fields as typed, kept in a ref too so a change reads the latest without waiting for a render. */
function useTyped<F>(initial: () => Typed<F>) {
  const [typed, setTyped] = useState(initial);
  const latest = useRef(typed);
  const set = (next: Typed<F>) => {
    latest.current = next;
    setTyped(next);
  };
  return { typed, latest, set };
}

/** A section as the draft holds it: its answers, its version and "No changes". */
interface SectionView<K extends HotelFormSectionKey> {
  readonly answers: HotelFormSectionAnswers[K];
  readonly version: number;
  readonly noChanges: boolean;
}

/** The fields as typed, each change handed to the autosave, and why a change could not be sent. */
function useTypedSection<K extends HotelFormSectionKey, F>(
  key: K,
  model: SectionModel<K, F>,
  section: SectionView<K>,
  autosave: RefObject<SectionAutosave<K> | null>,
) {
  const [problem, setProblem] = useState<string | null>(null);
  const { typed, latest, set } = useTyped(() => ({
    fields: model.fieldsOf(section.answers, newKey),
    noChanges: section.noChanges,
  }));
  const saved = useRef(section.answers);
  useEffect(() => {
    saved.current = section.answers;
  }, [section.answers]);
  const commit = (next: Typed<F>) => {
    set(next);
    const { answers } = model.answersOf(next.fields, saved.current);
    const check = payloadOf(key, answers, next.noChanges);
    setProblem(check.kind === "refused" ? check.message : null);
    if (check.kind === "send") autosave.current?.change(check.payload);
  };
  const replace = (next: Typed<F>) => {
    set(next);
    setProblem(null);
  };
  return { typed, latest, commit, replace, problem };
}

type Touched = ReturnType<typeof useTouched>;
type Typing<F> = ReturnType<typeof useTypedSection<HotelFormSectionKey, F>>;

/** What the person can do: change, leave a field, retry, and the conflict's two ways on. */
function actionsOf<K extends HotelFormSectionKey, F>(
  model: SectionModel<K, F>,
  autosave: RefObject<SectionAutosave<K> | null>,
  typing: Typing<F>,
  touched: Touched,
) {
  const { latest, commit } = typing;
  return {
    update: (change: (fields: F) => F) =>
      commit({ ...latest.current, fields: change(latest.current.fields) }),
    setNoChanges: (isOn: boolean) => commit({ ...latest.current, noChanges: isOn }),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      touched.touch(event.target.id);
      autosave.current?.flush();
    },
    retry: () => autosave.current?.retry(),
    keepMine: () => autosave.current?.keepMine(),
    takeTheirs: () => {
      const theirs = autosave.current?.takeTheirs();
      if (!theirs) return;
      typing.replace({
        fields: model.fieldsOf(theirs.answers, newKey),
        noChanges: theirs.noChanges,
      });
      touched.reset();
    },
  };
}

/**
 * A section page's editor: the fields filled from the draft once, each change read through the section's
 * model and handed to the autosave, messages shown for fields the person has left, and the conflict's
 * two ways on. The draft's own copy follows each save (the api-client writes it), so a refused field
 * falls back to what was saved last.
 *
 *   const editor = useSectionEditor("rooms", ROOMS_MODEL, site, draft);
 */
export function useSectionEditor<K extends HotelFormSectionKey, F extends RefreshNote>(
  key: K,
  model: SectionModel<K, F>,
  site: HotelFormSite,
  draft: HotelFormDraftView,
): SectionEditor<F> {
  const section: SectionView<K> = draft.sections[key];
  const [save, setSave] = useState<SaveState<K>>({ kind: "idle" });
  const opened = {
    version: section.version,
    saved: { answers: section.answers, noChanges: section.noChanges },
  };
  const autosave = useSectionAutosave(key, site, opened, setSave);
  const typing = useTypedSection(key, model, section, autosave);
  const touched = useTouched();
  const { fields, noChanges } = typing.typed;
  const built = useMemo(
    () => model.answersOf(fields, section.answers),
    [model, fields, section.answers],
  );
  return {
    fields,
    noChanges,
    isReadOnly: hotelFormStateOf(draft.request.status) !== "ready" || save.kind === "locked",
    save,
    problem: typing.problem,
    hasMarked: Object.keys(built.errors).some(touched.isTouched),
    errorOf: (id, always = false) =>
      always || touched.isTouched(id) ? built.errors[id] : undefined,
    ...actionsOf(model, autosave, typing, touched),
    newKey,
  };
}
