import {
  hotelFormContactDraft,
  hotelFormContactRow,
  type HotelFormPerson,
  type HotelFormSectionAnswers,
} from "@ampm/core";

import { answerReader, fieldId, isBlankRow, textOf } from "./field-values";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Contact for weddings and events (plan §5.1: 1.7 and 1.8; D-190 §2): up to 3 contacts, each with a
 * name, role, phone and email, and "Same as me" filled in on the page from the person's own details.
 * Contacts carry no row id, so the page keys each row itself and keeps on the row what the API holds for
 * it, from the draft and then from each save as it lands (review fix E2): a refused field is sent as its
 * own row last saved it, never matched to a saved contact by its place, which a removal would shift.
 */

type Answers = HotelFormSectionAnswers["contact"];
type SavedContact = NonNullable<Answers["contacts"]>[number];

const SHAPE = hotelFormContactDraft.shape;
const ROW = hotelFormContactRow.shape;

export interface ContactRowFields {
  /** The page's own key for the row. */
  readonly key: string;
  readonly name: string;
  readonly role: string;
  readonly phone: string;
  readonly email: string;
  /** What the API holds for the row, as its last save stored it; null for a row never saved. */
  readonly saved: SavedContact | null;
}

export interface ContactFields {
  readonly contacts: readonly ContactRowFields[];
  readonly noLongerOffered: string;
}

/** A contact field's id. */
export const contactId = (key: string, part: string) => fieldId("contact", key, part);

/** A contact with nothing typed yet. */
export const emptyContact = (key: string): ContactRowFields => ({
  key,
  name: "",
  role: "",
  phone: "",
  email: "",
  saved: null,
});

/**
 * "Same as me": a contact filled with the person's own name and designation, and the mobile they gave
 * on this tab's sign-in when the page still has it (the API never sends a mobile back); an email typed
 * already is kept.
 *
 * @example
 * sameAsMe(row, me.person, flow.state.claim.mobile);
 */
export function sameAsMe(
  row: ContactRowFields,
  person: HotelFormPerson,
  mobile: string,
): ContactRowFields {
  const phone = mobile.trim() === "" ? row.phone : mobile;
  return { ...row, name: person.fullName, role: person.designation, phone };
}

function fieldsOf(answers: Answers, newKey: () => string): ContactFields {
  const saved = answers.contacts ?? [];
  const contacts =
    saved.length === 0
      ? [emptyContact(newKey())]
      : saved.map((contact) => ({
          key: newKey(),
          name: textOf(contact.name),
          role: textOf(contact.role),
          phone: textOf(contact.phone),
          email: textOf(contact.email),
          saved: contact,
        }));
  return { contacts, noLongerOffered: textOf(answers.noLongerOffered) };
}

/** A contact with nothing typed in it: not sent. */
const isBlankContact = (row: ContactRowFields): boolean =>
  isBlankRow([row.name, row.role, row.phone, row.email]);

function answersOf(fields: ContactFields, saved: Answers): BuiltAnswers<"contact"> {
  const r = answerReader();
  const contacts = fields.contacts
    .filter((row) => !isBlankContact(row))
    .map((row) => {
      const id = (part: string) => contactId(row.key, part);
      return {
        name: r.read(id("name"), ROW.name, row.name, row.saved?.name ?? null),
        role: r.read(id("role"), ROW.role, row.role, row.saved?.role ?? null),
        phone: r.read(id("phone"), ROW.phone, row.phone, row.saved?.phone ?? null),
        email: r.read(id("email"), ROW.email, row.email, row.saved?.email ?? null),
      };
    });
  const noLongerOffered = r.read(
    fieldId("contact", "noLongerOffered"),
    SHAPE.noLongerOffered,
    fields.noLongerOffered,
    saved.noLongerOffered,
  );
  return { answers: { contacts, noLongerOffered }, errors: r.errors };
}

/**
 * The fields once a save read from `sentFrom` stored `sent`: each contact it sent keeps what it stored,
 * one it left out as blank keeps nothing, and every field keeps what was typed since.
 */
function savedInto(fields: ContactFields, sentFrom: ContactFields, sent: Answers): ContactFields {
  const stored = new Map<string, SavedContact | null>(
    sentFrom.contacts.map((row) => [row.key, null]),
  );
  sentFrom.contacts
    .filter((row) => !isBlankContact(row))
    .forEach((row, index) => stored.set(row.key, sent.contacts?.[index] ?? null));
  const contacts = fields.contacts.map((row) => {
    const saved = stored.get(row.key);
    return saved === undefined ? row : { ...row, saved };
  });
  return { ...fields, contacts };
}

/**
 * The contact section's fields and their reading.
 *
 * @example
 * const fields = CONTACT_MODEL.fieldsOf(draft.sections.contact.answers, newKey);
 */
export const CONTACT_MODEL: SectionModel<"contact", ContactFields> = {
  fieldsOf,
  answersOf,
  savedInto,
};
