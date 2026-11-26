import type { Prisma } from "../../../generated/prisma/client.js";

/*
 * How the hotel form names a person of a request to the request's other people (D-190, as decided after
 * the reviews): by name only while their privacy notice consent is live. A person who withdrew every
 * consent ("all") is no longer named on the form: not among the people helping, not as a section's last
 * editor, not in a conflict's details, not as who submitted; the page calls them a colleague. A new code
 * records the notice's consent again, and names them again. Staff views read people their own way and are
 * untouched.
 */

/** A live privacy notice consent: what keeps a person named on the form. */
export const LIVE_NOTICE_CONSENT = {
  kind: "privacy_notice",
  withdrawnAt: null,
  deletedAt: null,
} as const satisfies Prisma.HotelInfoRequestConsentWhereInput;

/** What naming a person reads: their name, and one live privacy notice consent if they have one. */
export const NAMED_PERSON_SELECT = {
  fullName: true,
  consents: { where: LIVE_NOTICE_CONSENT, select: { id: true }, take: 1 },
} as const satisfies Prisma.HotelInfoRequestPersonSelect;

/** A person as {@link NAMED_PERSON_SELECT} reads them. */
export interface NamedPersonRow {
  readonly fullName: string;
  readonly consents: readonly { readonly id: string }[];
}

/**
 * Whether the form may name the person to the request's other people.
 *
 * @example
 * isNamedOnForm({ fullName: "Synthetic Colleague", consents: [] }); // false
 */
export function isNamedOnForm(person: NamedPersonRow): boolean {
  return person.consents.length > 0;
}

/**
 * The person's name as the request's other people see it: null once they withdrew their privacy notice
 * consent.
 *
 * @example
 * formNameOf(row.lastEditor); // "Synthetic Colleague", or null
 */
export function formNameOf(person: NamedPersonRow): string | null {
  return isNamedOnForm(person) ? person.fullName : null;
}
