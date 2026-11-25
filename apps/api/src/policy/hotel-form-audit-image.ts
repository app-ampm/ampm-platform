import { redact } from "@ampm/core";

/*
 * What an audit image may keep when a hotel-form contributor acts (D-180, D-189 §6): an outsider wrote
 * it, so the image is allow-listed rather than masked. It keeps ids, the names of the fields that changed,
 * and masked values; every other key is dropped, nested objects included. Personal values stay in the
 * tables the masking tool reaches (plan §9.3), never in the audit log.
 */

const MASKED = "[redacted]";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `id`, `requestId`, `person_id`: a key that names one record. */
const ID_KEY = /^(?:id|.+Id|.+_id)$/;
/** `fileIds`, `person_ids`: a key that names several. */
const IDS_KEY = /^(?:.+Ids|.+_ids)$/;
/** The key that lists the names of the changed fields, as the request audits do (D-188). */
const CHANGED_FIELDS_KEY = "changedFields";
/** A field's name: what a field is called, never what someone typed into it. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** One key's kept value, or undefined when the key is dropped. */
function keptValue(key: string, value: unknown, masked: unknown): unknown {
  if (masked === MASKED) return MASKED;
  if (ID_KEY.test(key) && (value === null || isId(value))) return value;
  if (IDS_KEY.test(key) && Array.isArray(value)) return value.filter(isId);
  if (key === CHANGED_FIELDS_KEY && Array.isArray(value)) {
    return value.filter(
      (name): name is string => typeof name === "string" && FIELD_NAME.test(name),
    );
  }
  return undefined;
}

/**
 * A hotel-form contributor's audit image (D-189 §6): its ids (UUIDs, alone or listed, or null), its
 * `changedFields` names, and its masked values (`[redacted]`, as `redact()` masks personal keys). Null
 * stays null and absent stays absent; an image that is not a plain object is dropped.
 *
 * @example
 * hotelFormAuditImage({ id, fullName: "…", note: "…", changedFields: ["fullName"] });
 * // { id, fullName: "[redacted]", changedFields: ["fullName"] }
 */
export function hotelFormAuditImage(image: unknown): Record<string, unknown> | null | undefined {
  if (image === undefined || image === null) return image;
  if (!isPlainObject(image)) return undefined;
  const masked = redact(image);
  const maskedValues = isPlainObject(masked) ? masked : {};
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(image)) {
    const keep = keptValue(key, value, maskedValues[key]);
    if (keep !== undefined) kept[key] = keep;
  }
  return kept;
}
