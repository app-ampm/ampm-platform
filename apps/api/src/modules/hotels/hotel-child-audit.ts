/*
 * The audit images of a staff write to a hotel's room category, venue or contact (security.md: before and
 * after values on every create, update and delete). Pure. An image names the row and the fields the write
 * set or changed, compared as the staff view reads them (a decimal as a number, a venue's setting through
 * `venueSettingOf`), never their values, as the import's events do: so a contact's phone and email stay
 * out of it, and it is recorded unmasked. Beside the row's name, the one value an image holds is a
 * contact's primary flag, in a contact create and in a demotion, so the log says which contact took or
 * lost the hotel's primary. The rows' views carry `name` and their own ids.
 */

/** A room, venue or contact as its staff view reads it: its fields by name, `name` among them. */
export type ChildView = Readonly<Record<string, unknown>> & { readonly name: string };

/** What an audit event records before and after a write. */
export interface ChildAuditImages {
  readonly before: unknown;
  readonly after: unknown;
}

/** The ids a view carries, which no write changes. */
const IDS = new Set(["id", "hotelId"]);

const fieldsOf = (view: ChildView): string[] => Object.keys(view).filter((key) => !IDS.has(key));

const sameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What a create records after: the row's name and the fields it sets (those holding a value). */
interface CreatedImage {
  readonly name: string;
  readonly changedFields: readonly string[];
}

const createdImage = (created: ChildView): CreatedImage => ({
  name: created.name,
  changedFields: fieldsOf(created).filter((key) => (created[key] ?? null) !== null),
});

/**
 * A create's images: nothing before; after, the name and the fields it sets (those holding a value).
 *
 * @example
 * createImages(toRoomCategoryView(created)); // { before: null, after: { name, changedFields: ["name", "sizeSqm", …] } }
 */
export function createImages(created: ChildView): ChildAuditImages {
  return { before: null, after: createdImage(created) };
}

/**
 * A contact create's images: a create's, with the primary flag's value, since the flag always holds one
 * (false included), so its name among the fields set would not say whether the contact took the primary.
 *
 * @example
 * contactCreateImages(toHotelContactView(created));
 * // { before: null, after: { name, changedFields: ["name", "phone", "isPrimary"], isPrimary: true } }
 */
export function contactCreateImages(
  created: ChildView & { readonly isPrimary: boolean },
): ChildAuditImages {
  return { before: null, after: { ...createdImage(created), isPrimary: created.isPrimary } };
}

/**
 * The images of a contact a new primary demoted: its name before and after, and the primary flag, the
 * one field the demotion changed.
 *
 * @example
 * demotionImages({ name: "Sales desk" });
 * // before: { name: "Sales desk", isPrimary: true }
 * // after: { name: "Sales desk", isPrimary: false, changedFields: ["isPrimary"] }
 */
export function demotionImages({ name }: { readonly name: string }): ChildAuditImages {
  return {
    before: { name, isPrimary: true },
    after: { name, isPrimary: false, changedFields: ["isPrimary"] },
  };
}

/**
 * An update's images: the name before and after, and the fields whose value it changed, in the view's
 * order; a field sent with the value it already had is no change, and one the units rule cleared is.
 *
 * @example
 * updateImages(toRoomCategoryView(stored), toRoomCategoryView(updated));
 * // { before: { name: "Deluxe" }, after: { name: "Deluxe", changedFields: ["sizeSqm", "sizeSqft"] } }
 */
export function updateImages(stored: ChildView, updated: ChildView): ChildAuditImages {
  const changedFields = fieldsOf(updated).filter((key) => !sameValue(stored[key], updated[key]));
  return { before: { name: stored.name }, after: { name: updated.name, changedFields } };
}

/**
 * A soft delete's images: the name of the row it retired.
 *
 * @example
 * deleteImages(stored); // { before: { name: "Deluxe" }, after: { deleted: true } }
 */
export function deleteImages(stored: { readonly name: string }): ChildAuditImages {
  return { before: { name: stored.name }, after: { deleted: true } };
}
