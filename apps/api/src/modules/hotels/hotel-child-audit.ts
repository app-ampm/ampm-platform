/*
 * The audit images of a staff write to a hotel's room category, venue or contact (security.md: before and
 * after values on every create, update and delete). Pure. An image names the row and the fields the write
 * set or changed, compared as the staff view reads them (a decimal as a number, a venue's setting through
 * `venueSettingOf`), never their values, as the import's events do: so a contact's phone and email stay
 * out of it, and it is recorded unmasked. The rows' views carry `name` and their own ids.
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

/**
 * A create's images: nothing before; after, the name and the fields it sets (those holding a value).
 *
 * @example
 * createImages(toRoomCategoryView(created)); // { before: null, after: { name, changedFields: ["name", "sizeSqm", …] } }
 */
export function createImages(created: ChildView): ChildAuditImages {
  const changedFields = fieldsOf(created).filter((key) => (created[key] ?? null) !== null);
  return { before: null, after: { name: created.name, changedFields } };
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
