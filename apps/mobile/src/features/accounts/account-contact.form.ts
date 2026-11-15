import {
  accountContactCreateRequest,
  accountContactUpdateRequest,
  type AccountContactCreateRequest,
  type AccountContactUpdateRequest,
  type AccountContactView,
} from "@ampm/core";

/*
 * Pure form logic for a client account's contact (TW-13 Overview): the draft the sheet edits, and the
 * request bodies it builds, validated by the same Zod contracts the API checks. An edit sends only what
 * changed, and never the email of a contact who signs in with it (the API refuses that too).
 */

export interface ContactDraft {
  readonly name: string;
  readonly relation: string;
  readonly email: string;
  readonly phone: string;
  readonly isDecisionMaker: boolean;
  /** Add only: also create the contact's portal login and send the invite. */
  readonly invite: boolean;
}

export type ContactField = "name" | "relation" | "email" | "phone";
export type ContactErrors = Readonly<Partial<Record<ContactField, string>>>;

const MESSAGES: Record<ContactField, string> = {
  name: "Enter their name",
  relation: "Say who they are, such as bride or father of the groom",
  email: "Enter a valid email address",
  phone: "Enter a valid phone number",
};

const INVITE_NEEDS_EMAIL = "Give an email to send the portal invite to";

/** The draft for a new contact, or for editing one as it stands. */
export function contactDraftOf(contact?: AccountContactView): ContactDraft {
  return {
    name: contact?.name ?? "",
    relation: contact?.relation ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    isDecisionMaker: contact?.isDecisionMaker ?? false,
    invite: false,
  };
}

function isContactField(key: PropertyKey | undefined): key is ContactField {
  return key === "name" || key === "relation" || key === "email" || key === "phone";
}

/** One message per field, in the form's words rather than the schema's. */
function errorsOf(
  issues: ReadonlyArray<{ readonly path: readonly PropertyKey[] }>,
  draft: ContactDraft,
): ContactErrors {
  const errors: Partial<Record<ContactField, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (!isContactField(field) || errors[field]) continue;
    const inviteWithoutEmail = field === "email" && draft.invite && draft.email.trim() === "";
    errors[field] = inviteWithoutEmail ? INVITE_NEEDS_EMAIL : MESSAGES[field];
  }
  return errors;
}

const blankToUndefined = (value: string): string | undefined =>
  value.trim() === "" ? undefined : value;
const blankToNull = (value: string): string | null => (value.trim() === "" ? null : value);

export type Built<T> =
  { readonly ok: true; readonly body: T } | { readonly ok: false; readonly errors: ContactErrors };

/** The add body (`POST …/contacts`), or the field errors that stop it. */
export function buildContactCreate(draft: ContactDraft): Built<AccountContactCreateRequest> {
  const parsed = accountContactCreateRequest.safeParse({
    name: draft.name,
    relation: draft.relation,
    email: blankToUndefined(draft.email),
    phone: blankToUndefined(draft.phone),
    isDecisionMaker: draft.isDecisionMaker,
    invite: draft.invite,
  });
  return parsed.success
    ? { ok: true, body: parsed.data }
    : { ok: false, errors: errorsOf(parsed.error.issues, draft) };
}

/** The changed fields of an edit; a portal user's email is never among them. */
function changesOf(draft: ContactDraft, contact: AccountContactView): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  if (draft.name.trim() !== contact.name) changes["name"] = draft.name;
  if (draft.relation.trim() !== contact.relation) changes["relation"] = draft.relation;
  const email = blankToNull(draft.email.trim().toLowerCase());
  if (contact.userId === null && email !== contact.email) changes["email"] = email;
  const phone = blankToNull(draft.phone.trim());
  if (phone !== contact.phone) changes["phone"] = phone;
  if (draft.isDecisionMaker !== contact.isDecisionMaker) {
    changes["isDecisionMaker"] = draft.isDecisionMaker;
  }
  return changes;
}

/**
 * The edit body (`PATCH …/contacts/:id`) holding only what changed; `null` when nothing did, so the sheet
 * closes without a request.
 */
export function buildContactUpdate(
  draft: ContactDraft,
  contact: AccountContactView,
): Built<AccountContactUpdateRequest | null> {
  const changes = changesOf(draft, contact);
  if (Object.keys(changes).length === 0) return { ok: true, body: null };
  const parsed = accountContactUpdateRequest.safeParse(changes);
  return parsed.success
    ? { ok: true, body: parsed.data }
    : { ok: false, errors: errorsOf(parsed.error.issues, draft) };
}
