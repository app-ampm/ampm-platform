import {
  HOTEL_PHONE_REFUSAL,
  hotelContactCreateRequest,
  normaliseHotelPhone,
  type HotelContactCreateRequest,
  type HotelContactUpdateRequest,
  type HotelContactView,
} from "@ampm/core";

import { changedEntries, textOrNull } from "./hotel-form-fields";

/*
 * The hotel contact editor's form logic (RESTRICTED-CONTACT; TW-22, D-178), pure so it is tested without
 * rendering. A phone is saved in E.164 (core `normaliseHotelPhone`, the rule the API stores by), and the
 * editor previews that form as it is typed. A phone is checked and sent only when its text changed, so a
 * contact saved before E.164 with a free-text phone never blocks an unrelated edit (the API accepts a
 * phone equal to the stored one unchanged). Saving a contact as primary makes the API demote the
 * hotel's current primary in the same write.
 */

export interface ContactDraft {
  readonly name: string;
  readonly roleTitle: string;
  readonly phone: string;
  readonly email: string;
  readonly isPrimary: boolean;
}

export function draftFromContact(contact: HotelContactView | null): ContactDraft {
  return {
    name: contact?.name ?? "",
    roleTitle: contact?.roleTitle ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    isPrimary: contact?.isPrimary ?? false,
  };
}

/** Whether the phone's text differs from the stored one (none, for a new contact). */
export function isPhoneChanged(draft: ContactDraft, contact: HotelContactView | null): boolean {
  return draft.phone.trim() !== (contact?.phone ?? "").trim();
}

/** What a save does with the phone: there is none, it is saved as `phone`, or it is refused. */
export type PhonePreview =
  | { readonly kind: "none" }
  | { readonly kind: "saved"; readonly phone: string }
  | { readonly kind: "refused" };

/**
 * The phone as a save keeps it: an unchanged phone as it is stored, a changed one in E.164, refused
 * when it does not read as one full number (an extension, two numbers, too few digits).
 *
 * @example
 * phonePreview({ ...draft, phone: "0141-234 5678" }, null); // { kind: "saved", phone: "+911412345678" }
 */
export function phonePreview(draft: ContactDraft, contact: HotelContactView | null): PhonePreview {
  const phone = draft.phone.trim();
  if (phone === "") return { kind: "none" };
  if (!isPhoneChanged(draft, contact)) return { kind: "saved", phone };
  const e164 = normaliseHotelPhone(phone);
  return e164 === null ? { kind: "refused" } : { kind: "saved", phone: e164 };
}

/** The line under the phone box: how to write one, the form it is saved in, or why it is refused. */
export function phoneHint(preview: PhonePreview): string {
  if (preview.kind === "saved") return `Saved as ${preview.phone}`;
  if (preview.kind === "refused") return HOTEL_PHONE_REFUSAL;
  return "Ten digits for an Indian number, or + and the country code";
}

export type ContactErrors = {
  readonly name: string | undefined;
  readonly phone: string | undefined;
  readonly email: string | undefined;
};

/** Whether the contract takes the email: the sheet checks it by the rule the API validates with. */
const isContractEmail = (email: string): boolean =>
  hotelContactCreateRequest.shape.email.safeParse(email).success;

export function validateContact(
  draft: ContactDraft,
  contact: HotelContactView | null,
): ContactErrors {
  const email = draft.email.trim();
  return {
    name: draft.name.trim() === "" ? "Give the contact a name" : undefined,
    phone: phonePreview(draft, contact).kind === "refused" ? HOTEL_PHONE_REFUSAL : undefined,
    email: email !== "" && !isContractEmail(email) ? "Enter a valid email address" : undefined,
  };
}

/** The create body from a valid draft: the phone in E.164, the email lower-cased, blanks as null. */
export function buildContactBody(draft: ContactDraft): HotelContactCreateRequest {
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  return {
    name: draft.name.trim(),
    roleTitle: textOrNull(draft.roleTitle),
    // A phone that does not read stays as typed only when it is the stored one, which is never sent.
    phone: phone === "" ? null : (normaliseHotelPhone(phone) ?? phone),
    email: email === "" ? null : email.toLowerCase(),
    isPrimary: draft.isPrimary,
  };
}

/**
 * An update's body: what the draft changes from the contact as the sheet opened it, the phone only when
 * its text changed. Empty when nothing changed.
 *
 * @example
 * contactUpdateBody({ ...draftFromContact(contact), isPrimary: true }, contact); // { isPrimary: true }
 */
export function contactUpdateBody(
  draft: ContactDraft,
  contact: HotelContactView,
): HotelContactUpdateRequest {
  const { phone, ...next } = buildContactBody(draft);
  const { phone: _opened, ...opened } = buildContactBody(draftFromContact(contact));
  const changed = changedEntries(next, opened);
  return isPhoneChanged(draft, contact) ? { ...changed, phone } : changed;
}
