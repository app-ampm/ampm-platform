import { normaliseEmail, normaliseRowName } from "./hotel-change-set.js";
import { normaliseHotelPhone } from "./hotel-phone.js";

/*
 * Row matching for HotelChangeSet (D-178, D-181; docs/planning/hotel-information-form-plan.md §4.6, §4.8):
 * which stored room, venue or contact an incoming one is. Exact matches on normalised keys only; similar
 * names and venue-type suggestions wait for the form's merge (Slice 11). A match is never a rename: the
 * caller keeps the stored name. Pure, so the imports and the merge share it.
 */

/** A stored room or venue as matched: anything with a name. */
export interface HotelNamedRow {
  readonly name: string;
}

/**
 * What an incoming row name matches among a hotel's live rows:
 * - `new`: no live row has the name, so the row is created;
 * - `existing`: exactly one does, so that row is updated in place;
 * - `ambiguous`: two or more live rows share it, which the caller reports (rename one in the staff app);
 * - `repeated`: an earlier incoming name of the same hotel is the same, so this one is a row error.
 */
export type HotelRowMatch<R> =
  | { readonly match: "new" }
  | { readonly match: "existing"; readonly row: R }
  | { readonly match: "ambiguous"; readonly rows: readonly R[] }
  | { readonly match: "repeated"; readonly firstIndex: number };

/**
 * Matches one hotel's incoming row names, in file order, to its live rows by normalised name
 * (`normaliseRowName`: whitespace collapsed, case ignored), exact only. Pass only live rows: a
 * soft-deleted row never matches, so a retired name creates a new row. One result per incoming name.
 *
 * @example
 * matchRowsByName([{ id: "r1", name: "Lake View Suite" }], ["lake view  suite", "Garden Room", "Lake View Suite"]);
 * // [{ match: "existing", row: { id: "r1", … } }, { match: "new" }, { match: "repeated", firstIndex: 0 }]
 */
export function matchRowsByName<R extends HotelNamedRow>(
  existingLiveRows: readonly R[],
  incomingNames: readonly string[],
): HotelRowMatch<R>[] {
  const byName = new Map<string, R[]>();
  for (const row of existingLiveRows) {
    const key = normaliseRowName(row.name);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }
  const firstSeen = new Map<string, number>();
  return incomingNames.map((name, index): HotelRowMatch<R> => {
    const key = normaliseRowName(name);
    const firstIndex = firstSeen.get(key);
    if (firstIndex !== undefined) return { match: "repeated", firstIndex };
    firstSeen.set(key, index);
    const rows = byName.get(key) ?? [];
    const [only] = rows;
    if (only === undefined) return { match: "new" };
    return rows.length === 1 ? { match: "existing", row: only } : { match: "ambiguous", rows };
  });
}

/** A stored hotel contact as matched. */
export interface HotelMatchableContact {
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
}

/** An incoming contact: whichever of its channels and name it gives. */
export interface HotelContactProbe {
  readonly name?: string | null | undefined;
  readonly email?: string | null | undefined;
  readonly phone?: string | null | undefined;
}

/** What a contact was matched by, in the order tried. */
export type HotelContactMatchKey = "email" | "phone" | "name";

/** Which stored contact an incoming one is: none, exactly one, or several sharing the deciding key. */
export type HotelContactMatch<C> =
  | { readonly match: "none" }
  | { readonly match: "existing"; readonly by: HotelContactMatchKey; readonly contact: C }
  | {
      readonly match: "ambiguous";
      readonly by: HotelContactMatchKey;
      readonly contacts: readonly C[];
    };

function blankAsNull(
  value: string | null | undefined,
  normalise: (text: string) => string,
): string | null {
  const normalised = value === null || value === undefined ? "" : normalise(value);
  return normalised === "" ? null : normalised;
}

/** Each key a contact is matched by, normalised; null when the contact has none, or it does not read. */
const CONTACT_KEYS: readonly (readonly [
  HotelContactMatchKey,
  (contact: HotelContactProbe) => string | null,
])[] = [
  ["email", (contact) => blankAsNull(contact.email, normaliseEmail)],
  ["phone", (contact) => (contact.phone ? normaliseHotelPhone(contact.phone) : null)],
  ["name", (contact) => blankAsNull(contact.name, normaliseRowName)],
];

/**
 * Matches an incoming contact to a hotel's live contacts: by email, then by E.164 phone (a stored phone
 * that does not read as one never matches), then by normalised name. The first key the incoming contact
 * has that any stored contact shares decides; a key it lacks, or one nobody shares, passes to the next.
 *
 * @example
 * matchContact([{ name: "Front desk", email: null, phone: "+911412345678" }], { phone: "0141 234 5678" });
 * // { match: "existing", by: "phone", contact: { name: "Front desk", … } }
 */
export function matchContact<C extends HotelMatchableContact>(
  existingLiveContacts: readonly C[],
  incoming: HotelContactProbe,
): HotelContactMatch<C> {
  for (const [by, keyOf] of CONTACT_KEYS) {
    const key = keyOf(incoming);
    if (key === null) continue;
    const hits = existingLiveContacts.filter((contact) => keyOf(contact) === key);
    const [only] = hits;
    if (only === undefined) continue;
    return hits.length === 1
      ? { match: "existing", by, contact: only }
      : { match: "ambiguous", by, contacts: hits };
  }
  return { match: "none" };
}
