import { hotelInfoRequestConsentKind, redact } from "@ampm/core";

/*
 * What an audit image may keep when a hotel-form contributor acts (D-180, D-189 §6): an outsider wrote
 * it, so the image is allow-listed rather than masked. It keeps ids, the names of the fields that changed,
 * and masked values; and for a submit or a withdrawal (D-190 §3), the revision's number, a SHA-256 hash
 * (what the declarations bind to) and the consent kinds. Every other key is dropped, nested objects
 * included. Personal values stay in the tables the masking tool reaches (plan §9.3), never in the audit
 * log.
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
/** The key of a submitted revision's number. */
const REVISION_KEY = "revision";
/**
 * The keys of a revision's SHA-256 (lower-case hex), which the declarations bind to; never a SECRET hash
 * (a link's, a session's, a mobile's), which no image names.
 */
const HASH_KEYS: ReadonlySet<string> = new Set(["answersHash", "revisionHash"]);
const SHA256 = /^[0-9a-f]{64}$/;
/** The keys of the consent kinds a submit recorded or a withdrawal took back. */
const KIND_KEY = "kind";
const KINDS_KEY = "kinds";

const isConsentKind = (value: unknown): boolean =>
  hotelInfoRequestConsentKind.safeParse(value).success;

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

/** A submit's or a withdrawal's fact (D-190 §3), or undefined when the key holds none. */
function keptFact(key: string, value: unknown): unknown {
  if (key === REVISION_KEY)
    return Number.isSafeInteger(value) && Number(value) >= 1 ? value : undefined;
  if (HASH_KEYS.has(key))
    return typeof value === "string" && SHA256.test(value) ? value : undefined;
  if (key === KIND_KEY) return isConsentKind(value) ? value : undefined;
  if (key === KINDS_KEY && Array.isArray(value)) return value.filter(isConsentKind);
  return undefined;
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
  return keptFact(key, value);
}

/**
 * A hotel-form contributor's audit image (D-189 §6): its ids (UUIDs, alone or listed, or null), its
 * `changedFields` names, and its masked values (`[redacted]`, as `redact()` masks personal keys); and a
 * submit's or a withdrawal's `revision` (a whole number from 1), `answersHash` or `revisionHash` (a
 * SHA-256) and `kind` or `kinds` (consent kinds only, D-190 §3). Null stays null and absent stays absent; an image that is not a plain
 * object is dropped.
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
