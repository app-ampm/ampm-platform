import {
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_DISPLAY_VERSION,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SECTION_KEYS,
  checkSubmit,
  hotelFormMissingItemsOf,
  hotelFormReadOnlyOf,
  hotelFormSectionVersionsOf,
  hotelFormSectionsChangedOf,
  hotelFormSubmitRequest,
  isAppError,
  type HotelFormDraftSections,
  type HotelFormDraftView,
  type HotelFormMissingItem,
  type HotelFormSectionKey,
  type HotelFormSubmitRequest,
} from "@ampm/core";

import { asksForSession, refusalOf } from "../refusal";
import { SECTION_TITLES } from "../sections-copy";
import {
  CONTACT_FIELDS_COPY,
  ROOM_FIELDS_COPY,
  VENUE_FIELDS_COPY,
} from "../sections/section-fields-copy";
import { REVIEW_COPY as COPY } from "./review-copy";

/*
 * HF-06's rules (D-190 §5; plan §4.4), pure so they are tested without a page: what Submit needs (7.4
 * ticked, 7.5 answered Yes or No, nothing missing, a passed bot check), the body it sends (the section
 * versions the page showed), the missing items and where each is, a colleague's recent save, and the page's
 * answer to each refusal of `POST /hotel-form/submit`.
 */

/** 7.4's tick and 7.5's answer as the page holds them; 7.5 starts unanswered and is never pre-selected. */
export interface DeclarationFields {
  readonly accuracyAccepted: boolean;
  readonly displayAnswer: "" | "yes" | "no";
}

export const EMPTY_DECLARATIONS: DeclarationFields = { accuracyAccepted: false, displayAnswer: "" };

/** Each declaration's refusal, in core's words. */
export interface DeclarationErrors {
  readonly accuracy?: string | undefined;
  readonly display?: string | undefined;
}

/** What pressing Submit does: fix a declaration, see what is missing, wait for the check, or send. */
export type SubmitStep =
  | { readonly kind: "fix_declarations" }
  | { readonly kind: "incomplete"; readonly items: readonly HotelFormMissingItem[] }
  | { readonly kind: "bot_check" }
  | { readonly kind: "send"; readonly request: HotelFormSubmitRequest };

export interface SubmitCheck {
  /** Shown on the declarations whatever the step: empty once both are answered. */
  readonly errors: DeclarationErrors;
  readonly step: SubmitStep;
}

/**
 * Every item a submit would be refused for, by core's `checkSubmit` for the request's kind (a section
 * whose stored answers no longer read named, as the API names it): empty when the form may be submitted.
 *
 * @example
 * missingItemsOf(draft); // [{ section: "property", field: "state", message: "Choose the state" }]
 */
export function missingItemsOf(draft: HotelFormDraftView): HotelFormMissingItem[] {
  const { sections } = draft;
  const saved = Object.fromEntries(
    HOTEL_FORM_SECTION_KEYS.map((key) => {
      const { answers, noChanges, isUnreadable } = sections[key];
      return [key, { answers, noChanges, isUnreadable }];
    }),
  );
  return checkSubmit({ kind: draft.request.kind, sections: saved });
}

/** The sections not complete yet: a warning only, since empty sections never block a submit. */
export function incompleteSectionsOf(draft: HotelFormDraftView): HotelFormSectionKey[] {
  return HOTEL_FORM_SECTION_KEYS.filter((key) => !draft.sections[key].isComplete);
}

/**
 * What pressing Submit does, in the order the page asks: the declarations (their errors shown whatever
 * comes next), the missing items, the bot check's pass, then the body: both declarations in the words in
 * force, and every section's version as the page showed it.
 *
 * @example
 * const { errors, step } = submitCheckOf(fields, draft, botCheck.token);
 */
export function submitCheckOf(
  fields: DeclarationFields,
  draft: HotelFormDraftView,
  botToken: string | null,
): SubmitCheck {
  const parsed = hotelFormSubmitRequest.safeParse({
    accuracy: { accepted: fields.accuracyAccepted, textVersion: HOTEL_FORM_ACCURACY_VERSION },
    display: { answer: fields.displayAnswer, textVersion: HOTEL_FORM_DISPLAY_VERSION },
    sectionVersions: hotelFormSectionVersionsOf(draft.sections),
    ...(botToken === null ? {} : { botToken }),
  });
  if (!parsed.success) {
    const errorAt = (path: string) =>
      parsed.error.issues.find((issue) => issue.path.join(".") === path)?.message;
    const errors = { accuracy: errorAt("accuracy.accepted"), display: errorAt("display.answer") };
    return { errors, step: { kind: "fix_declarations" } };
  }
  const items = missingItemsOf(draft);
  if (items.length > 0) return { errors: {}, step: { kind: "incomplete", items } };
  if (botToken === null) return { errors: {}, step: { kind: "bot_check" } };
  return { errors: {}, step: { kind: "send", request: parsed.data } };
}

const ROW = /^(contacts|rows)\.(\d+)(?:\.otherLayouts\.(\d+))?/;

/** The row a missing item's path names: its name when it has one, else its place in the section. */
function rowPlaceOf(item: HotelFormMissingItem, sections: HotelFormDraftSections): string | null {
  const match = item.field === null ? null : ROW.exec(item.field);
  if (!match) return null;
  const place = Number(match[2]);
  if (item.section === "contact") return CONTACT_FIELDS_COPY.row(place + 1);
  if (item.section === "rooms")
    return sections.rooms.answers.rows?.[place]?.name ?? ROOM_FIELDS_COPY.row(place + 1);
  if (item.section !== "venues") return null;
  const venue = sections.venues.answers.rows?.[place];
  const name = venue?.name ?? VENUE_FIELDS_COPY.row(place + 1);
  if (match[3] === undefined) return name;
  const layout = Number(match[3]);
  const layoutName =
    venue?.otherLayouts?.[layout]?.layout ?? VENUE_FIELDS_COPY.layoutRow(layout + 1);
  return COPY.missing.layout(name, layoutName);
}

/**
 * Where a missing item is, in words: its section, and the row by its name or its place.
 *
 * @example
 * missingItemWhere({ section: "venues", field: "rows.0.seated.max", message }, draft.sections);
 * // "Venues · Synthetic Lawn"
 */
export function missingItemWhere(
  item: HotelFormMissingItem,
  sections: HotelFormDraftSections,
): string {
  return COPY.missing.where(SECTION_TITLES[item.section].title, rowPlaceOf(item, sections));
}

/** How recent a colleague's save must be for the page to warn before submitting (D-190 §5). */
export const COLLEAGUE_WINDOW_MS = 5 * 60 * 1000;

/** A colleague's recent save: the section, who (null for a colleague who withdrew consent), when. */
export interface ColleagueSave {
  readonly section: HotelFormSectionKey;
  readonly editedBy: string | null;
  readonly editedAt: string;
}

/**
 * Whether a save under this name is the person's own. The draft names editors, not people, so a name a
 * colleague shares with the person counts as a colleague's: the warning errs on the side of showing.
 */
function isOwnSave(editedBy: string | null, draft: HotelFormDraftView): boolean {
  const you = draft.contributors.find((person) => person.isYou)?.fullName ?? null;
  if (editedBy === null || you === null || editedBy !== you) return false;
  return !draft.contributors.some((person) => !person.isYou && person.fullName === you);
}

/**
 * The sections a colleague saved in the last five minutes (anyone but the person, a colleague who
 * withdrew consent included), in the form's order: the review page warns before the person submits.
 *
 * @example
 * colleagueSavesOf(draft, Date.now()); // [{ section: "rooms", editedBy: "Ravi Kumar", editedAt }]
 */
export function colleagueSavesOf(draft: HotelFormDraftView, now: number): ColleagueSave[] {
  return HOTEL_FORM_SECTION_KEYS.flatMap((section) => {
    const { lastEditedBy: editedBy, lastEditedAt: editedAt } = draft.sections[section];
    if (editedAt === null || now - Date.parse(editedAt) >= COLLEAGUE_WINDOW_MS) return [];
    return isOwnSave(editedBy, draft) ? [] : [{ section, editedBy, editedAt }];
  });
}

/** The page's answer to a refused submit. */
export type SubmitRefusal =
  /** The session's own refusal: the flow asks for a new code in place. */
  | { readonly kind: "session" }
  /** 409 noticeStale: the words of 7.4 or 7.5 changed under the page; reload it. */
  | { readonly kind: "reload"; readonly message: string }
  /** 400 on `botToken`: the pass was refused; the check runs again. */
  | { readonly kind: "bot"; readonly message: string }
  /** 409 sectionsChanged: a colleague saved these sections since the page read them. */
  | {
      readonly kind: "sections_changed";
      readonly message: string;
      readonly sections: readonly HotelFormSectionKey[];
    }
  /** 400 submitIncomplete: every missing item the API found. */
  | {
      readonly kind: "incomplete";
      readonly message: string;
      readonly items: readonly HotelFormMissingItem[];
    }
  /** 409 alreadySubmitted: the form was submitted already; the status page says by whom and when. */
  | { readonly kind: "already_submitted"; readonly message: string }
  /** 429: wait, then submit again. */
  | { readonly kind: "wait"; readonly message: string; readonly seconds: number }
  | { readonly kind: "message"; readonly message: string };

/** The refusals only submit gives, read from the error's details; null for any other. */
function submitOnlyRefusalOf(error: unknown): SubmitRefusal | null {
  if (!isAppError(error)) return null;
  const sections = hotelFormSectionsChangedOf(error);
  if (sections !== null) return { kind: "sections_changed", message: error.message, sections };
  const isAlready =
    error.code === "conflict" &&
    (error.message === HOTEL_FORM_ERRORS.alreadySubmitted || hotelFormReadOnlyOf(error) !== null);
  if (isAlready) return { kind: "already_submitted", message: error.message };
  if (error.code !== "validation_failed") return null;
  if (error.details?.some((detail) => detail.path === "botToken"))
    return { kind: "bot", message: error.message };
  const items = hotelFormMissingItemsOf(error);
  return items.length > 0 ? { kind: "incomplete", message: error.message, items } : null;
}

/**
 * The page's answer to a refused `POST /hotel-form/submit`, in the API's words (the page's own only when
 * the API had none to give).
 *
 * @example
 * const refusal = submitRefusalOf(error); // { kind: "sections_changed", sections: ["rooms"], … }
 */
export function submitRefusalOf(error: unknown): SubmitRefusal {
  const own = submitOnlyRefusalOf(error);
  if (own !== null) return own;
  const refusal = refusalOf(error);
  if (asksForSession(refusal)) return { kind: "session" };
  if (refusal.kind === "reload" || refusal.kind === "wait") return refusal;
  return { kind: "message", message: refusal.message };
}
