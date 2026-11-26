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
 * Contacts carry no row id, so the page keys each row itself; a refused field is sent blank while it is
 * refused rather than matched to a saved contact by its place, which a removal would shift.
 */

type Answers = HotelFormSectionAnswers["contact"];

const SHAPE = hotelFormContactDraft.shape;
const ROW = hotelFormContactRow.shape;

export interface ContactRowFields {
  /** The page's own key for the row. */
  readonly key: string;
  readonly name: string;
  readonly role: string;
  readonly phone: string;
  readonly email: string;
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
        }));
  return { contacts, noLongerOffered: textOf(answers.noLongerOffered) };
}

function answersOf(fields: ContactFields, saved: Answers): BuiltAnswers<"contact"> {
  const r = answerReader();
  const typed = fields.contacts.filter(
    (row) => !isBlankRow([row.name, row.role, row.phone, row.email]),
  );
  const contacts = typed.map((row) => ({
    name: r.read(contactId(row.key, "name"), ROW.name, row.name, null),
    role: r.read(contactId(row.key, "role"), ROW.role, row.role, null),
    phone: r.read(contactId(row.key, "phone"), ROW.phone, row.phone, null),
    email: r.read(contactId(row.key, "email"), ROW.email, row.email, null),
  }));
  const noLongerOffered = r.read(
    fieldId("contact", "noLongerOffered"),
    SHAPE.noLongerOffered,
    fields.noLongerOffered,
    saved.noLongerOffered,
  );
  return { answers: { contacts, noLongerOffered }, errors: r.errors };
}

/**
 * The contact section's fields and their reading.
 *
 * @example
 * const fields = CONTACT_MODEL.fieldsOf(draft.sections.contact.answers, newKey);
 */
export const CONTACT_MODEL: SectionModel<"contact", ContactFields> = { fieldsOf, answersOf };
