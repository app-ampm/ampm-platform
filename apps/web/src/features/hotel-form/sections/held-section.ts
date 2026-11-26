import type {
  HotelFormSectionAnswers,
  HotelFormSectionKey,
  HotelFormSectionSaved,
} from "@ampm/core";

import {
  createSectionAutosave,
  type SaveRefusal,
  type SaveState,
  type SectionAutosave,
  type SectionPayload,
  type SendOptions,
} from "./section-autosave";
import type { SectionModel } from "./section-model";
import type { PayloadCheck } from "./section-payload";

/*
 * One section's answers as the person typed them and its autosave, held by the form's layout rather than
 * the section's page (D-190 §5, review fixes E1 and E4): leaving the section keeps both, so a 429 still
 * waits out its Retry-After and sends what was typed, "Not saved" keeps its Retry, and coming back shows
 * the section as it was left, never the draft from before its own save. Apart from React, so its timing
 * is tested with fake timers; the page reads it through `useSyncExternalStore`.
 */

/** The section as the draft holds it when it is first opened: its version and saved answers. */
export interface OpenedSection<K extends HotelFormSectionKey> {
  readonly version: number;
  readonly saved: SectionPayload<K>;
}

/** The check a save must pass before it is sent (section-payload.ts), handed in by the section's page. */
export type PayloadChecker = <K extends HotelFormSectionKey>(
  key: K,
  answers: HotelFormSectionAnswers[K],
  noChanges: boolean,
) => PayloadCheck<K>;

/** How the section's page reads its fields: its model, and the check its saves pass. */
export interface SectionReading<K extends HotelFormSectionKey, F> {
  readonly model: SectionModel<K, F>;
  readonly check: PayloadChecker;
}

/** What the section's page shows: the fields, the save line, and what refused fields fall back to. */
export interface HeldView<K extends HotelFormSectionKey, F> {
  readonly fields: F;
  /** "No changes since last time" (refresh requests). */
  readonly noChanges: boolean;
  readonly save: SaveState<K>;
  /** Why the section cannot be sent as it stands (over its cap), said on the save line. */
  readonly problem: string | null;
  /** The fields the person has left: their messages show from then on. */
  readonly touched: ReadonlySet<string>;
  /** What the API holds for the section as far as this page knows: a refused field is sent as this. */
  readonly saved: HotelFormSectionAnswers[K];
}

/**
 * Whether a section has text not saved yet: `waiting` saves by itself (on its way, after the delay, a
 * 429's wait, a new code), `unsaved` needs the person (Not saved, a colleague's save, a submitted form, a
 * refused field). Null when everything typed is saved.
 */
export type HeldPending = "waiting" | "unsaved" | null;

/** What a held section needs from the form: how it saves, how a refusal reads, and whom to tell of a change. */
export interface HeldSectionDeps<K extends HotelFormSectionKey> {
  readonly send: (
    payload: SectionPayload<K>,
    expectedVersion: number,
    options: SendOptions,
  ) => Promise<HotelFormSectionSaved>;
  readonly refusalOf: (error: unknown) => SaveRefusal<K>;
  readonly onChange: () => void;
}

/** A new row's key: a UUID, which rooms and venues keep as the row id. */
export const newRowKey = (): string => crypto.randomUUID();

const NONE_TOUCHED: ReadonlySet<string> = new Set();
const NEEDS_PERSON: ReadonlySet<SaveState<HotelFormSectionKey>["kind"]> = new Set([
  "failed",
  "conflict",
  "locked",
]);
const SAVES_BY_ITSELF: ReadonlySet<SaveState<HotelFormSectionKey>["kind"]> = new Set([
  "saving",
  "waiting",
  "session",
]);

/**
 * One section held for the form's pages.
 *
 * @example
 * const held = new HeldSection("rooms", { model: ROOMS_MODEL, check: payloadOf }, opened, deps);
 * held.update((fields) => ({ ...fields, totalRooms: "41" })); // saves 1.5 s later
 */
export class HeldSection<K extends HotelFormSectionKey, F> {
  private view: HeldView<K, F>;
  private hasRefused = false;
  private attachments = 0;
  private readonly listeners = new Set<() => void>();
  private readonly autosave: SectionAutosave<K>;

  constructor(
    readonly key: K,
    private reading: SectionReading<K, F>,
    opened: OpenedSection<K>,
    private readonly deps: HeldSectionDeps<K>,
  ) {
    this.view = {
      fields: reading.model.fieldsOf(opened.saved.answers, newRowKey),
      noChanges: opened.saved.noChanges,
      save: { kind: "idle" },
      problem: null,
      touched: NONE_TOUCHED,
      saved: opened.saved.answers,
    };
    this.autosave = createSectionAutosave<K>({
      ...opened,
      send: deps.send,
      refusalOf: deps.refusalOf,
      onState: (save) => this.set({ save }),
      onSaved: (payload) => this.landed(payload),
    });
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly snapshot = (): HeldView<K, F> => this.view;

  /** A change the person made: the section saves once typing stops. */
  readonly update = (change: (fields: F) => F): void =>
    this.commit(change(this.view.fields), this.view.noChanges);

  readonly setNoChanges = (isOn: boolean): void => this.commit(this.view.fields, isOn);

  /** Leaving a field: its message shows from now on, and the section saves at once. */
  readonly leave = (id: string): void => {
    if (id !== "" && !this.view.touched.has(id))
      this.set({ touched: new Set([...this.view.touched, id]) });
    this.autosave.flush();
  };

  readonly retry = (): void => this.autosave.retry();

  readonly keepMine = (): void => this.autosave.keepMine();

  /** A colleague saved first: their answers become the page's, saving nothing. */
  readonly takeTheirs = (): void => {
    const theirs = this.autosave.takeTheirs();
    if (theirs === null) return;
    this.hasRefused = false;
    this.set({
      fields: this.reading.model.fieldsOf(theirs.answers, newRowKey),
      noChanges: theirs.noChanges,
      problem: null,
      touched: NONE_TOUCHED,
      saved: theirs.answers,
    });
  };

  /** The section's page reads the fields with this model from now on (the draft's options may change it). */
  readWith(reading: SectionReading<K, F>): void {
    this.reading = reading;
  }

  /** The section's page opened (again) on it. */
  attach(): void {
    this.attachments += 1;
  }

  /** The section's page went: what waits to be saved goes now, as on leaving a field. */
  detach(): void {
    this.attachments -= 1;
    this.autosave.flush();
  }

  isAttached(): boolean {
    return this.attachments > 0;
  }

  /** The version the section's next save goes on. */
  version(): number {
    return this.autosave.version();
  }

  pending(): HeldPending {
    const { save, problem } = this.view;
    if (problem !== null || this.hasRefused || NEEDS_PERSON.has(save.kind)) return "unsaved";
    return SAVES_BY_ITSELF.has(save.kind) || this.autosave.hasUnsaved() ? "waiting" : null;
  }

  flush(options: SendOptions): void {
    this.autosave.flush(options);
  }

  pendingBytes(): number {
    return this.autosave.pendingBytes();
  }

  /** The same person's new session is there: what waited for it is saved. */
  resume(): void {
    this.autosave.resume();
  }

  /** Dropped (signed out, someone else signed in): nothing more is sent. */
  stop(): void {
    this.autosave.stop();
  }

  private commit(fields: F, noChanges: boolean): void {
    const { answers, errors } = this.reading.model.answersOf(fields, this.view.saved);
    const check = this.reading.check(this.key, answers, noChanges);
    this.hasRefused = Object.keys(errors).length > 0;
    if (check.kind === "send") this.autosave.change(check.payload);
    // Told last, so what the overview reads already counts the change.
    this.set({ fields, noChanges, problem: check.kind === "refused" ? check.message : null });
  }

  /** A save landed: refused fields fall back to what it stored from now on. */
  private landed(payload: SectionPayload<K>): void {
    this.set({ saved: payload.answers });
  }

  private set(change: Partial<HeldView<K, F>>): void {
    this.view = { ...this.view, ...change };
    for (const listener of this.listeners) listener();
    this.deps.onChange();
  }
}
