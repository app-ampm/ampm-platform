import {
  canonicalJson,
  type HotelFormReadOnly,
  type HotelFormSectionAnswers,
  type HotelFormSectionConflict,
  type HotelFormSectionKey,
  type HotelFormSectionSaved,
} from "@ampm/core";

/*
 * A section's autosave (D-190 §5; plan §4.4), apart from React so its timing is tested with fake timers:
 * 1.5 seconds after typing stops, at once on leaving a field or when the page is hidden, one save at a
 * time, and never the answers the API already holds. Each refusal has its way on: a colleague's save waits
 * for Keep mine or Take theirs, a locked request stops for good (what was typed stays on the page), a 429
 * waits out its Retry-After, an ended session waits for a new code, anything else says Not saved – retry.
 */

/** How long typing must stop before a section saves. */
export const AUTOSAVE_DELAY_MS = 1_500;

/** What a section's save sends besides its version: the answers, and "No changes since last time". */
export interface SectionPayload<K extends HotelFormSectionKey> {
  readonly answers: HotelFormSectionAnswers[K];
  readonly noChanges: boolean;
}

/** Why a save did not go through, as the page treats it (sections/section-save.ts reads the error). */
export type SaveRefusal<K extends HotelFormSectionKey> =
  | { readonly kind: "conflict"; readonly theirs: HotelFormSectionConflict<K> }
  | { readonly kind: "locked"; readonly readOnly: HotelFormReadOnly | null }
  | { readonly kind: "session" }
  | { readonly kind: "wait"; readonly message: string; readonly seconds: number }
  | { readonly kind: "failed"; readonly message: string };

/** The save line and the banners above the section, as the page shows them. */
export type SaveState<K extends HotelFormSectionKey> =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | { readonly kind: "saved" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "waiting"; readonly message: string; readonly retryAt: number }
  | { readonly kind: "conflict"; readonly theirs: HotelFormSectionConflict<K> }
  | { readonly kind: "locked"; readonly readOnly: HotelFormReadOnly | null }
  | { readonly kind: "session" };

export interface AutosaveOptions<K extends HotelFormSectionKey> {
  /** The saved section's version: 0 before its first save. */
  readonly version: number;
  /** What the API holds for the section. */
  readonly saved: SectionPayload<K>;
  readonly send: (
    payload: SectionPayload<K>,
    expectedVersion: number,
  ) => Promise<HotelFormSectionSaved>;
  readonly refusalOf: (error: unknown) => SaveRefusal<K>;
  readonly onState: (state: SaveState<K>) => void;
}

export interface SectionAutosave<K extends HotelFormSectionKey> {
  /** The person changed the section: it saves once typing has stopped for a while. */
  readonly change: (payload: SectionPayload<K>) => void;
  /** Saves now: a field was left, the page was hidden. */
  readonly flush: () => void;
  /** Not saved – retry. */
  readonly retry: () => void;
  /** A colleague saved first: save these answers on their version. */
  readonly keepMine: () => void;
  /** A colleague saved first: their save becomes the page's; returns it for the page's fields. */
  readonly takeTheirs: () => SectionPayload<K> | null;
  /** A new code opened a new session: save what was waiting. */
  readonly resume: () => void;
  /** Whether anything typed is not saved yet (or is being saved). */
  readonly hasUnsaved: () => boolean;
  /** The page goes: what is left is saved, and the page hears nothing more. */
  readonly dispose: () => void;
}

const textOf = <K extends HotelFormSectionKey>(payload: SectionPayload<K>): string =>
  canonicalJson(payload);

/** States in which nothing saves until the person or the page acts. */
const HELD: ReadonlySet<SaveState<HotelFormSectionKey>["kind"]> = new Set([
  "conflict",
  "locked",
  "session",
  "waiting",
]);

/**
 * A section's autosave, from what the API holds; the page reports every change and every flush.
 *
 * @example
 * const autosave = createSectionAutosave({ version, saved, send, refusalOf, onState: setSaveState });
 * autosave.change({ answers, noChanges }); // saves 1.5 s later
 */
export function createSectionAutosave<K extends HotelFormSectionKey>(
  options: AutosaveOptions<K>,
): SectionAutosave<K> {
  const run = new AutosaveRun(options);
  return {
    change: (payload) => run.change(payload),
    flush: () => run.flush(),
    retry: () => run.flush(),
    keepMine: () => run.keepMine(),
    takeTheirs: () => run.takeTheirs(),
    resume: () => run.resume(),
    hasUnsaved: () => run.hasUnsaved(),
    dispose: () => run.dispose(),
  };
}

/** The autosave's state between calls; one per section page. */
class AutosaveRun<K extends HotelFormSectionKey> {
  private version: number;
  private savedText: string;
  private latest: SectionPayload<K> | null = null;
  private state: SaveState<K> = { kind: "idle" };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private isSending = false;
  private isQueued = false;
  private isDisposed = false;

  constructor(private readonly options: AutosaveOptions<K>) {
    this.version = options.version;
    this.savedText = textOf(options.saved);
  }

  change(payload: SectionPayload<K>): void {
    this.latest = payload;
    if (this.isHeld()) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.save(), AUTOSAVE_DELAY_MS);
    // What was just typed waits out the delay: the line says Saving… rather than the last Saved.
    if (this.state.kind === "saved" && this.isUnsaved()) this.show({ kind: "saving" });
  }

  flush(): void {
    if (this.isHeld()) return;
    this.clearTimer();
    this.save();
  }

  keepMine(): void {
    if (this.state.kind !== "conflict") return;
    const { answers, noChanges, version } = this.state.theirs;
    // The API holds the colleague's save now, so answers undone back to this page's own last save still go.
    this.version = version;
    this.savedText = textOf({ answers, noChanges });
    this.show({ kind: "saved" });
    this.save();
  }

  takeTheirs(): SectionPayload<K> | null {
    if (this.state.kind !== "conflict") return null;
    const { answers, noChanges, version } = this.state.theirs;
    const theirs: SectionPayload<K> = { answers, noChanges };
    this.version = version;
    this.savedText = textOf(theirs);
    this.latest = theirs;
    this.show({ kind: "saved" });
    return theirs;
  }

  resume(): void {
    if (this.state.kind !== "session") return;
    this.show({ kind: "idle" });
    this.save();
  }

  hasUnsaved(): boolean {
    return this.isSending || this.isUnsaved();
  }

  dispose(): void {
    this.clearTimer();
    if (!this.isHeld()) this.save();
    this.isDisposed = true;
  }

  private isHeld(): boolean {
    return HELD.has(this.state.kind);
  }

  private isUnsaved(): boolean {
    return this.latest !== null && textOf(this.latest) !== this.savedText;
  }

  private save(): void {
    const payload = this.latest;
    if (payload === null || this.isHeld()) return;
    if (this.isSending) {
      this.isQueued = true;
      return;
    }
    if (!this.isUnsaved()) {
      if (this.state.kind !== "idle") this.show({ kind: "saved" });
      return;
    }
    this.isSending = true;
    this.isQueued = false;
    this.show({ kind: "saving" });
    const text = textOf(payload);
    this.options.send(payload, this.version).then(
      (saved) => this.saved(saved, text),
      (error: unknown) => this.refused(this.options.refusalOf(error)),
    );
  }

  private saved(saved: HotelFormSectionSaved, text: string): void {
    this.isSending = false;
    this.version = saved.version;
    this.savedText = text;
    // Newer typing still to go (queued, or waiting out its delay) keeps the line at Saving….
    this.show(this.isUnsaved() ? { kind: "saving" } : { kind: "saved" });
    if (this.isQueued) this.save();
  }

  private refused(refusal: SaveRefusal<K>): void {
    this.isSending = false;
    this.isQueued = false;
    this.clearTimer();
    if (refusal.kind !== "wait") {
      this.show(refusal.kind === "session" ? { kind: "session" } : refusal);
      return;
    }
    const retryAt = Date.now() + refusal.seconds * 1_000;
    this.show({ kind: "waiting", message: refusal.message, retryAt });
    this.timer = setTimeout(() => {
      this.show({ kind: "idle" });
      this.save();
    }, refusal.seconds * 1_000);
  }

  private show(state: SaveState<K>): void {
    this.state = state;
    if (!this.isDisposed) this.options.onState(state);
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
