import { errors } from "./errors";

/*
 * Canonical JSON (D-190 §1 and §2): one text for one content, so the hotel form's API and site agree on
 * "unchanged", and on a section's size against its cap. Pure, so the API hashes it (SHA-256 of its UTF-8,
 * `content_hash` and `answers_hash`) while the site, which needs no hash, compares the texts. A blank is
 * absent, as the drafts treat it: a member that is undefined or null, or an empty list or object, is left
 * out, while false, 0 and "" stay. A list keeps every entry in its place, a blank one included, so a
 * field's path still names its row. Keys go in JavaScript's string order (UTF-16 code units), written by
 * hand because JSON.stringify puts keys that look like numbers first.
 */

/** A value as canonical JSON writes it. */
type Canonical = string | number | boolean | null | Canonical[] | { [key: string]: Canonical };

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBlank(value: Canonical): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "object" && Object.keys(value).length === 0;
}

/** An object's members, the blank ones left out; {@link write} puts them in order. */
function canonicalObject(value: object): Canonical {
  const out: { [key: string]: Canonical } = {};
  for (const [key, item] of Object.entries(value)) {
    const member = canonical(item);
    if (!isBlank(member)) out[key] = member;
  }
  return out;
}

function canonical(value: unknown): Canonical {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw errors.internal("Canonical JSON takes finite numbers only");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && isPlainObject(value)) return canonicalObject(value);
  throw errors.internal("Canonical JSON takes plain JSON values only");
}

function write(value: Canonical): string {
  if (Array.isArray(value)) return `[${value.map(write).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const members = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${write(value[key] ?? null)}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * A JSON value as canonical text: keys in order, no whitespace, blank members left out. Throws on what
 * JSON cannot carry (a non-finite number, a bigint, a function, a date or any other non-plain object).
 *
 * @example
 * canonicalJson({ b: 1, a: null, c: { d: "x" } }); // '{"b":1,"c":{"d":"x"}}'
 * createHash("sha256").update(canonicalJson(answers)).digest("hex"); // the API's content hash
 */
export function canonicalJson(value: unknown): string {
  return write(canonical(value));
}

/**
 * How many bytes text takes in UTF-8, as a section's cap counts its canonical JSON. A lone surrogate
 * counts as the replacement character a UTF-8 encoder writes for it (3 bytes).
 *
 * @example
 * utf8ByteLength("महल"); // 9
 * utf8ByteLength("😀"); // 4
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && isLowSurrogate(text.charCodeAt(index + 1))) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function isLowSurrogate(unit: number): boolean {
  return unit >= 0xdc00 && unit <= 0xdfff;
}
