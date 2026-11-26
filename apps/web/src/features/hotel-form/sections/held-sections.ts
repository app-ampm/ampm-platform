import type { HotelFormSectionSaveCall } from "@ampm/api-client";
import {
  HOTEL_FORM_SECTION_KEYS,
  type HotelFormSectionKey,
  type HotelFormSectionSaved,
} from "@ampm/core";

import type { BookingTermsFields } from "./booking-terms.form";
import type { ContactFields } from "./contact.form";
import type { FactSheetFields } from "./fact-sheet.form";
import type { FoodBeverageFields } from "./food-beverage.form";
import {
  HeldSection,
  type HeldPending,
  type HeldSectionDeps,
  type OpenedSection,
  type SectionReading,
} from "./held-section";
import type { PropertyFields } from "./property.form";
import type { RoomsFields } from "./rooms.form";
import type { SaveRefusal, SectionPayload, SendOptions } from "./section-autosave";
import { saveRefusalOf } from "./section-save";
import type { VenuesFields } from "./venues.form";

/*
 * Every section's held answers and autosave, for as long as the form's layout is mounted (D-190 §5,
 * review fixes E1, E4 and E5). They belong to the person who typed them: a save goes only under that
 * person's session, a different person signing in drops them all, and so do signing out and anything else
 * that forgets the form. The overview reads which sections still wait to save, and the page asks before
 * the tab closes while any does.
 */

/** Each section's fields as its page holds them. */
export interface SectionFieldsMap {
  readonly property: PropertyFields;
  readonly contact: ContactFields;
  readonly rooms: RoomsFields;
  readonly venues: VenuesFields;
  readonly booking_terms: BookingTermsFields;
  readonly food_beverage: FoodBeverageFields;
  readonly fact_sheet_media: FactSheetFields;
}

/** One section's place in the store: its held section, once it was opened. */
interface Slot<K extends HotelFormSectionKey> {
  section: HeldSection<K, SectionFieldsMap[K]> | undefined;
}

type Slots = { readonly [K in HotelFormSectionKey]: Slot<K> };

const emptySlots = (): Slots => ({
  property: { section: undefined },
  contact: { section: undefined },
  rooms: { section: undefined },
  venues: { section: undefined },
  booking_terms: { section: undefined },
  food_beverage: { section: undefined },
  fact_sheet_media: { section: undefined },
});

/** What the store does with any held section, whatever its fields. */
interface HeldEntry {
  readonly key: HotelFormSectionKey;
  pending(): HeldPending;
  pendingBytes(): number;
  flush(options: SendOptions): void;
  resume(): void;
  stop(): void;
}

/** The session as a save asks for it: its token, and the person it belongs to once known. */
export interface FormSession {
  readonly token: string | null;
  readonly personId: string | undefined;
}

export interface HeldSectionsDeps {
  /** A section's save: `useSaveHotelFormSection().mutateAsync`, which also keeps the cached draft. */
  readonly save: (call: HotelFormSectionSaveCall) => Promise<HotelFormSectionSaved>;
  /** The flow's session now. */
  readonly session: () => FormSession;
  /** A save refused for the session's sake: the flow asks for a new code in place. */
  readonly refuseSession: (error: unknown) => void;
}

/** The sections with text not saved yet, each with whether it saves by itself. */
export type HeldStatuses = Readonly<
  Partial<Record<HotelFormSectionKey, Exclude<HeldPending, null>>>
>;

/** A save asked for with no session of the person who typed it (a new code asked for, someone else). */
const NO_SESSION = new Error("No form session for the person who typed this");

/** What keepalive bodies may add up to at once: under the browser's 64 KiB, with room for headers. */
export const KEEPALIVE_BUDGET_BYTES = 60_000;

const NONE: HeldStatuses = {};

const sameStatuses = (a: HeldStatuses, b: HeldStatuses): boolean =>
  HOTEL_FORM_SECTION_KEYS.every((key) => a[key] === b[key]);

/**
 * The form's held sections: the layout makes one, every page reaches it through the form's site.
 *
 * @example
 * const held = sections.open("rooms", { model: ROOMS_MODEL, check: payloadOf }, opened, personId);
 * sections.sessionChanged({ token, personId }); // a new code: the same person's text goes on
 */
export class HeldSections {
  private slots: Slots = emptySlots();
  private owner: string | undefined;
  private drops = 0;
  private statusCache: HeldStatuses = NONE;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: HeldSectionsDeps) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Which sections have text not saved yet, for the overview. */
  readonly statuses = (): HeldStatuses => this.statusCache;

  /** Moves on each time the held sections are dropped, so an open section page takes a fresh one. */
  readonly generation = (): number => this.drops;

  /** Forgets every held section, sending nothing more: signed out, the form forgotten. */
  readonly drop = (): void => {
    this.each((section) => section.stop());
    this.slots = emptySlots();
    this.owner = undefined;
    this.drops += 1;
    this.statusCache = NONE;
    this.tell();
  };

  /**
   * The section as held, or as the draft holds it when nothing of it is held: a section left with text
   * not saved, or with its page still open, is never replaced by an older or newer draft. `personId` is
   * whom the page opens it for (the person signed in as it renders): what is typed from now on is theirs.
   */
  open<K extends HotelFormSectionKey>(
    key: K,
    reading: SectionReading<K, SectionFieldsMap[K]>,
    opened: OpenedSection<K>,
    personId: string | undefined,
  ): HeldSection<K, SectionFieldsMap[K]> {
    const slot: Slot<K> = this.slots[key];
    const held = slot.section;
    if (held !== undefined && !this.isOutdated(held, opened)) return held;
    held?.stop();
    this.owner ??= personId;
    const created = new HeldSection(key, reading, opened, this.depsOf(key));
    slot.section = created;
    return created;
  }

  /** The flow's session moved: another person drops what is held; the same person's goes on. */
  sessionChanged({ token, personId }: FormSession): void {
    if (personId === undefined) return;
    if (this.owner !== undefined && personId !== this.owner) this.drop();
    if (token !== null && personId === this.owner) this.each((section) => section.resume());
  }

  /** The page is hidden or closed: what waits goes now, with keepalive while the bodies fit its limit. */
  flushAll({ keepalive }: SendOptions): void {
    let budget = keepalive ? KEEPALIVE_BUDGET_BYTES : 0;
    this.each((section) => {
      const bytes = section.pendingBytes();
      const fits = bytes > 0 && bytes <= budget;
      if (fits) budget -= bytes;
      section.flush({ keepalive: fits });
    });
  }

  /** Whether any section has text not saved yet: the tab asks before it closes. */
  hasPending(): boolean {
    return Object.keys(this.statusCache).length > 0;
  }

  private isOutdated<K extends HotelFormSectionKey>(
    held: HeldSection<K, SectionFieldsMap[K]>,
    opened: OpenedSection<K>,
  ): boolean {
    return !held.isAttached() && held.pending() === null && opened.version > held.version();
  }

  private depsOf<K extends HotelFormSectionKey>(key: K): HeldSectionDeps<K> {
    return {
      send: (payload, expectedVersion, { keepalive }) =>
        this.send(key, payload, expectedVersion, keepalive),
      refusalOf: (error) => this.refusalOf(key, error),
      onChange: () => this.changed(),
    };
  }

  private send<K extends HotelFormSectionKey>(
    key: K,
    payload: SectionPayload<K>,
    expectedVersion: number,
    keepalive: boolean,
  ): Promise<HotelFormSectionSaved> {
    const { token, personId } = this.deps.session();
    // What one person typed never goes under another person's session (review fix E1).
    if (token === null || personId === undefined || personId !== this.owner)
      return Promise.reject(NO_SESSION);
    const save = { answers: payload.answers, expectedVersion, noChanges: payload.noChanges };
    return this.deps.save({
      sessionToken: token,
      section: key,
      save,
      ...(keepalive ? { keepalive } : {}),
    });
  }

  private refusalOf<K extends HotelFormSectionKey>(key: K, error: unknown): SaveRefusal<K> {
    if (error === NO_SESSION) return { kind: "session" };
    const refusal = saveRefusalOf(error, key);
    if (refusal.kind === "session") this.deps.refuseSession(error);
    return refusal;
  }

  private changed(): void {
    const next: Partial<Record<HotelFormSectionKey, Exclude<HeldPending, null>>> = {};
    this.each((section) => {
      const pending = section.pending();
      if (pending !== null) next[section.key] = pending;
    });
    if (sameStatuses(next, this.statusCache)) return;
    this.statusCache = next;
    this.tell();
  }

  private tell(): void {
    for (const listener of this.listeners) listener();
  }

  private each(run: (section: HeldEntry) => void): void {
    for (const key of HOTEL_FORM_SECTION_KEYS) {
      const section: HeldEntry | undefined = this.slots[key].section;
      if (section !== undefined) run(section);
    }
  }
}
