import type { HotelFormPerson } from "@ampm/core";
import { RepeatableFieldsets, TextField, useIsReadOnly } from "@ampm/web-forms";

import { FormButton } from "../form-parts";
import { textField, withRow } from "./bindings";
import {
  contactId,
  emptyContact,
  sameAsMe,
  type ContactFields,
  type ContactRowFields,
} from "./contact.form";
import { PAIR_STYLES } from "./field-group";
import { COMMON_FIELDS_COPY as COMMON, CONTACT_FIELDS_COPY as COPY } from "./section-fields-copy";
import type { SectionEditor } from "./use-section-editor";

type Editor = SectionEditor<ContactFields>;
type RowKey = "name" | "role" | "phone" | "email";

export interface ContactSectionProps {
  readonly editor: Editor;
  /** The signed-in person, for "Same as me"; undefined while their details load. */
  readonly person: HotelFormPerson | undefined;
  /** The mobile they gave on this tab's sign-in, or "" after a reload. */
  readonly mobile: string;
  /** The most contacts the draft takes (its caps). */
  readonly max: number;
}

interface RowProps {
  readonly editor: Editor;
  readonly row: ContactRowFields;
}

/** The contacts with one changed. */
const withContact = (
  fields: ContactFields,
  key: string,
  change: (row: ContactRowFields) => ContactRowFields,
): ContactFields => ({
  ...fields,
  contacts: withRow(fields.contacts, (row) => row.key === key, change),
});

/** A contact's name, role, phone and email. */
function ContactFieldsGrid({ editor, row }: RowProps) {
  const part = (key: RowKey) =>
    textField(editor, contactId(row.key, key), row[key], (fields, value) =>
      withContact(fields, row.key, (contact) => ({ ...contact, [key]: value })),
    );
  return (
    <div className={PAIR_STYLES}>
      <TextField label={COPY.name} {...part("name")} autoComplete="name" maxLength={255} />
      <TextField
        label={COPY.role}
        {...part("role")}
        autoComplete="organization-title"
        maxLength={255}
      />
      <TextField
        label={COPY.phone}
        help={COPY.phoneHelp}
        {...part("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
      />
      <TextField
        label={COPY.email}
        {...part("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={255}
      />
    </div>
  );
}

/**
 * One contact: "Same as me" once the person's details are read and while the form can change, then the
 * contact's fields.
 */
function ContactRow({
  editor,
  row,
  person,
  mobile,
}: RowProps & Pick<ContactSectionProps, "person" | "mobile">) {
  const isReadOnly = useIsReadOnly();
  const fillFromMe = (me: HotelFormPerson) =>
    editor.update((fields) =>
      withContact(fields, row.key, (contact) => sameAsMe(contact, me, mobile)),
    );
  return (
    <>
      {person && !isReadOnly ? (
        <FormButton variant="secondary" onClick={() => fillFromMe(person)}>
          {COPY.sameAsMe}
        </FormButton>
      ) : null}
      <ContactFieldsGrid editor={editor} row={row} />
    </>
  );
}

/**
 * Contact for weddings and events (plan §5.1: 1.7, 1.8; D-190 §2): up to the draft's cap of contacts as
 * repeatable rows, each named by the contact's name, with "Same as me" filling one from the person's own
 * details.
 *
 *   <ContactSection editor={editor} person={me.person} mobile={claim.mobile} max={draft.caps.contacts} />
 */
export function ContactSection({ editor, person, mobile, max }: ContactSectionProps) {
  const add = () =>
    editor.update((fields) => ({
      ...fields,
      contacts: [...fields.contacts, emptyContact(editor.newKey())],
    }));
  const remove = (key: string) =>
    editor.update((fields) => ({
      ...fields,
      contacts: fields.contacts.filter((row) => row.key !== key),
    }));
  return (
    <RepeatableFieldsets
      id="hf-contact-contacts"
      legend={COPY.legend}
      help={COPY.help}
      rows={editor.fields.contacts.map((row, index) => ({
        ...row,
        legend: row.name.trim() || COPY.row(index + 1),
      }))}
      renderRow={(row) => <ContactRow editor={editor} row={row} person={person} mobile={mobile} />}
      onAdd={add}
      onRemove={remove}
      addLabel={COPY.add}
      removeText={COMMON.remove}
      removeLabel={COMMON.removeNamed}
      removedText={COMMON.removed}
      max={max}
      capText={COPY.cap(max)}
      emptyText={COPY.empty}
    />
  );
}
