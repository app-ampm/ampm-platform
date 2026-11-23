import { normaliseHotelPhone } from "./hotel-phone.js";
import { areaWrite, type HotelAreaPair } from "./hotel-units.js";

/*
 * HotelChangeSet (D-178, D-181; docs/planning/hotel-information-form-plan.md §4.6, §4.8): how an incoming
 * room, venue, hotel or contact compares with what the catalogue stores, shared by the staff imports now
 * and the form's merge later. Pure and Hermes-safe (no Unicode property escapes, no `normalize`, no URL
 * parsing). Both sides are normalised before they are compared: whitespace, units, E.164 phones and
 * links. A blank incoming value never clears a stored one. Row matching is in hotel-row-match.ts.
 */

/**
 * How a field's values are normalised before they are compared: text (and an enum) trimmed with each run
 * of whitespace one space; a number or a boolean as it is; a list entry by entry, in order; entries (a
 * list of objects, such as a venue's other layouts) key by key; a link, a phone and an email by their
 * own normalisers.
 */
export type HotelFieldKind =
  "text" | "enum" | "number" | "boolean" | "list" | "entries" | "url" | "phone" | "email";

/** The fields a comparison covers, each with its kind, in the order changes are named. */
export type HotelFieldKinds<K extends string> = Readonly<Record<K, HotelFieldKind>>;

/** A stored or incoming record's values, as the staff views and the import rows carry them. */
export type HotelFieldValues<K extends string> = Readonly<Partial<Record<K, unknown>>>;

/** How {@link fieldChanges} compares. */
export interface HotelFieldChangeOptions<K extends string> {
  /** The [m², sq ft] pairs the units rule (`areaWrite`) settles before the compare. */
  readonly areas?: readonly HotelAreaPair<K>[];
}

/**
 * Text as compared: trimmed, each run of whitespace (line breaks included) one space.
 *
 * @example
 * normaliseWhitespace("  Lake   view\n suite "); // "Lake view suite"
 */
export function normaliseWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * A room's or venue's name as rows are matched on it: whitespace normalised, then lower-case.
 *
 * @example
 * normaliseRowName("  Lake  View Suite "); // "lake view suite"
 */
export function normaliseRowName(name: string): string {
  return normaliseWhitespace(name).toLowerCase();
}

/**
 * An email address as compared: trimmed and lower-case.
 *
 * @example
 * normaliseEmail(" Sales@Example.COM "); // "sales@example.com"
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A scheme, `//`, the authority (user info, host, port) and the rest, matched without URL parsing. */
const LINK = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)([\s\S]*)$/;

/**
 * A link as compared: trimmed, its scheme and host lower-case; the path, query and fragment keep their
 * case. Text that is not a link is only trimmed.
 *
 * @example
 * normaliseUrl(" HTTPS://WWW.Example.com/Rooms "); // "https://www.example.com/Rooms"
 */
export function normaliseUrl(url: string): string {
  const trimmed = url.trim();
  const match = LINK.exec(trimmed);
  if (match === null) return trimmed;
  const [, scheme = "", authority = "", rest = ""] = match;
  const at = authority.lastIndexOf("@") + 1;
  const host = authority.slice(0, at) + authority.slice(at).toLowerCase();
  return `${scheme.toLowerCase()}://${host}${rest}`;
}

/** A value as compared and hashed: JSON with normalised text, keys in order, and a blank as null. */
type Canonical = string | number | boolean | null | Canonical[] | { [key: string]: Canonical };

function canonicalText(text: string, kind: HotelFieldKind): string | null {
  let value: string;
  if (kind === "url") value = normaliseUrl(text);
  else if (kind === "email") value = normaliseEmail(text);
  else if (kind === "phone") value = normaliseHotelPhone(text) ?? normaliseWhitespace(text);
  else value = normaliseWhitespace(text);
  return value === "" ? null : value;
}

function canonicalList(items: readonly unknown[], kind: HotelFieldKind): Canonical {
  const kept = items.map((item) => canonical(item, kind)).filter((item) => item !== null);
  return kept.length === 0 ? null : kept;
}

const byKey = ([a]: readonly [string, unknown], [b]: readonly [string, unknown]): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** An object key by key in code-point order, so `{ max, layout }` and `{ layout, max }` compare equal. */
function canonicalObject(value: object, kind: HotelFieldKind): Canonical {
  const out: { [key: string]: Canonical } = {};
  for (const [key, item] of Object.entries(value).sort(byKey)) {
    const kept = canonical(item, kind);
    if (kept !== null) out[key] = kept;
  }
  return Object.keys(out).length === 0 ? null : out;
}

function canonical(value: unknown, kind: HotelFieldKind): Canonical {
  if (typeof value === "string") return canonicalText(value, kind);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return canonicalList(value, kind);
  if (typeof value === "object" && value !== null) return canonicalObject(value, kind);
  return null;
}

const keysOf = <K extends string>(fields: HotelFieldKinds<K>): K[] =>
  Object.keys(fields).filter((key): key is K => key in fields);

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

/** The incoming values after the units rule, and the sq ft fields it clears. */
interface SettledAreas<K extends string> {
  readonly values: ReadonlyMap<K, unknown>;
  readonly clears: ReadonlySet<K>;
}

/**
 * The units rule on each area pair: a filled sq ft replaces the m² with the derived figure; an m² filled
 * alone clears a stored sq ft. A blank (or null) incoming figure takes no part, since a blank never clears.
 */
function settleAreas<K extends string>(
  current: HotelFieldValues<K> | null,
  incoming: HotelFieldValues<K>,
  areas: readonly HotelAreaPair<K>[],
): SettledAreas<K> {
  const values = new Map<K, unknown>();
  const clears = new Set<K>();
  for (const pair of areas) {
    const stored = numberOrUndefined(current?.[pair.sqft]) ?? null;
    const write = areaWrite(
      { sqm: numberOrUndefined(incoming[pair.sqm]), sqft: numberOrUndefined(incoming[pair.sqft]) },
      stored,
    );
    if (write.sqm !== undefined) values.set(pair.sqm, write.sqm);
    if (write.sqft === null) clears.add(pair.sqft);
    else if (write.sqft !== undefined) values.set(pair.sqft, write.sqft);
  }
  return { values, clears };
}

const sameCanonical = (a: Canonical, b: Canonical): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The fields an incoming record changes, in the order of `fields`: those whose filled value differs from
 * the stored one once both are normalised by their kind. A blank incoming value (undefined, null, empty
 * or whitespace text, an empty list) never clears, so it is never a change. With `current` null (a
 * create) every filled field is one. With `areas`, the units rule runs first: a filled sq ft replaces the
 * m² with the derived figure, and an m² filled alone on a row that stores sq ft clears that sq ft, which
 * is then named too. Values are plain JSON as the staff views carry them (a decimal as a number).
 *
 * @example
 * fieldChanges(
 *   { sizeSqm: 40, sizeSqft: null, viewLabel: "Lake" },
 *   { sizeSqft: 500, viewLabel: " Lake " },
 *   { sizeSqm: "number", sizeSqft: "number", viewLabel: "text" },
 *   { areas: [{ sqm: "sizeSqm", sqft: "sizeSqft" }] },
 * ); // ["sizeSqm", "sizeSqft"]: 500 sq ft is 46 m²
 */
export function fieldChanges<K extends string>(
  current: HotelFieldValues<NoInfer<K>> | null,
  incoming: HotelFieldValues<NoInfer<K>>,
  fields: HotelFieldKinds<K>,
  options: HotelFieldChangeOptions<NoInfer<K>> = {},
): K[] {
  const settled = settleAreas(current, incoming, options.areas ?? []);
  return keysOf(fields).filter((key) => {
    const stored = canonical(current?.[key], fields[key]);
    if (settled.clears.has(key)) return stored !== null;
    const value = settled.values.has(key) ? settled.values.get(key) : incoming[key];
    const next = canonical(value, fields[key]);
    return next !== null && !sameCanonical(next, stored);
  });
}

/**
 * A record's compared fields as canonical JSON, in the order of `fields`, each normalised as
 * {@link fieldChanges} compares it and a blank as null: what the API hashes into an import target's
 * version token, so a value written the same way twice never reads as a change.
 *
 * @example
 * canonicalFieldsJson({ viewLabel: " Lake ", roomCount: 4 }, { roomCount: "number", viewLabel: "text" });
 * // '[["roomCount",4],["viewLabel","Lake"]]'
 */
export function canonicalFieldsJson<K extends string>(
  record: HotelFieldValues<NoInfer<K>>,
  fields: HotelFieldKinds<K>,
): string {
  return JSON.stringify(keysOf(fields).map((key) => [key, canonical(record[key], fields[key])]));
}
