import { refuse } from "./refusal.js";
import { decodeXmlEntities, XmlScanner } from "./xml-scan.js";
import { opcKey } from "./zip-names.js";

/*
 * The two kinds of part that describe an Office package (ECMA-376 Part 2, Open Packaging Conventions):
 * `[Content_Types].xml`, which gives every part its content type, and the relationship parts (`.rels`),
 * which say what each part points to. Both are read whole (each at most 2 MiB) and parsed with the same
 * tokenizer that scans the other parts. Their tags are handed on one at a time as they are read, and only
 * the elements a caller uses are parsed: a part of 2 MiB of empty tags once held 150 MiB of parsed tags.
 */

export interface Tag {
  readonly name: string;
  /** The name without its namespace prefix. */
  readonly local: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly selfClosing: boolean;
}

const TAG_NAME = /^<([^\s/>]+)/;
/*
 * An attribute's name starts only where a run of name characters starts (after whitespace, `=`, `/`, `>`
 * or a quote), never inside one: otherwise every position of a long run without `=` would retry the whole
 * run, in quadratic time, and the content types and package relationships are read before the type check.
 */
const ATTRIBUTE = /(?<![^\s=/>"'])([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The name, attributes (entities decoded) and form of a start tag as the tokenizer reports it. */
export function parseTag(raw: string, part: string): Tag {
  const name = TAG_NAME.exec(raw)?.[1] ?? "";
  const attributes = new Map<string, string>();
  for (const match of raw.slice(name.length + 1).matchAll(ATTRIBUTE)) {
    const [, key = "", double, single] = match;
    if (attributes.has(key)) refuse("file_damaged", `a repeated attribute ${key} in ${part}`);
    attributes.set(key, decodeXmlEntities(double ?? single ?? ""));
  }
  return {
    name,
    local: name.slice(name.indexOf(":") + 1),
    attributes,
    selfClosing: raw.endsWith("/>"),
  };
}

/**
 * Calls `visit` with each start tag of a whole XML part whose name without its prefix is in `names`, as
 * the tag is read. Nothing is kept, and no other tag is parsed past its name.
 *
 * @example
 * forEachTag(xml, "_rels/.rels", new Set(["Relationship"]), (tag) => check(tag.attributes));
 */
export function forEachTag(
  xml: Buffer,
  part: string,
  names: ReadonlySet<string>,
  visit: (tag: Tag) => void,
): void {
  const scanner = new XmlScanner(
    {
      startTag: (raw) => {
        const name = TAG_NAME.exec(raw)?.[1] ?? "";
        if (names.has(name.slice(name.indexOf(":") + 1))) visit(parseTag(raw, part));
      },
      endTag: () => undefined,
      text: () => undefined,
    },
    part,
  );
  scanner.write(xml);
  scanner.end();
}

const CONTENT_TYPE_TAGS: ReadonlySet<string> = new Set(["Default", "Override"]);
const RELATIONSHIP_TAGS: ReadonlySet<string> = new Set(["Relationship"]);

export interface ContentTypes {
  readonly defaults: ReadonlyMap<string, string>;
  readonly overrides: ReadonlyMap<string, string>;
}

/** A content type without parameters, lower-cased (MIME types compare without case). */
const bareType = (type: string): string => (type.split(";")[0] ?? "").trim().toLowerCase();

function setOnce(map: Map<string, string>, key: string, value: string, what: string): void {
  if (map.has(key)) refuse("archive_unsafe", `two content types for ${what}`);
  map.set(key, bareType(value));
}

/** The defaults (by extension) and overrides (by part name) of `[Content_Types].xml`. */
export function parseContentTypes(xml: Buffer): ContentTypes {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  forEachTag(xml, "[Content_Types].xml", CONTENT_TYPE_TAGS, (tag) => {
    const type = tag.attributes.get("ContentType");
    if (type === undefined) return;
    const extension = tag.attributes.get("Extension");
    const partName = tag.attributes.get("PartName");
    if (tag.local === "Default" && extension !== undefined) {
      setOnce(defaults, opcKey(extension), type, `the extension ${extension}`);
    } else if (tag.local === "Override" && partName !== undefined) {
      setOnce(overrides, opcKey(partName.replace(/^\//, "")), type, partName);
    }
  });
  return { defaults, overrides };
}

/**
 * A part's content type: its override, else the default for its extension, else null. Both are found by
 * the part's normalised name (`opcKey`), as Office finds them: `a.x%6Dl` takes the default for `xml`.
 */
export function contentTypeOf(types: ContentTypes, partName: string): string | null {
  const key = opcKey(partName);
  const override = types.overrides.get(key);
  if (override !== undefined) return override;
  const lastSegment = key.slice(key.lastIndexOf("/") + 1);
  const dot = lastSegment.lastIndexOf(".");
  if (dot < 0) return null;
  return types.defaults.get(lastSegment.slice(dot + 1)) ?? null;
}

export interface Relationship {
  /** The part the relationship belongs to, "" for the package itself. */
  readonly source: string;
  readonly type: string;
  readonly target: string;
  readonly external: boolean;
}

const RELS = /^(?:(.*)\/)?_rels\/([^/]*)\.rels$/;

/**
 * The part a relationship part describes ("" for `_rels/.rels`), or null when `name` is not one. Read from
 * the normalised name (`opcKey`), as Office reads it: `%5Frels/.rels` is the package relationships, and
 * the part it names comes back normalised too.
 */
export function sourceOfRels(name: string): string | null {
  const match = RELS.exec(opcKey(name));
  if (!match) return null;
  const [, folder, file = ""] = match;
  return folder === undefined ? file : `${folder}/${file}`;
}

/**
 * Calls `visit` with each relationship of a relationship part, as it is read; nothing is kept.
 *
 * @example
 * forEachRelationship(xml, "ppt/slides/_rels/slide1.xml.rels", refuseRelationship);
 */
export function forEachRelationship(
  xml: Buffer,
  relsName: string,
  visit: (relationship: Relationship) => void,
): void {
  const source = sourceOfRels(relsName) ?? "";
  forEachTag(xml, relsName, RELATIONSHIP_TAGS, (tag) =>
    visit({
      source,
      type: tag.attributes.get("Type") ?? "",
      target: tag.attributes.get("Target") ?? "",
      external: (tag.attributes.get("TargetMode") ?? "").toLowerCase() === "external",
    }),
  );
}

/**
 * The part an internal relationship points to, resolved against its source's folder, without a leading
 * slash; null when it climbs out of the package.
 */
export function resolveTarget(source: string, target: string): string | null {
  const path = target.split("#")[0] ?? "";
  const base = path.startsWith("/") ? [] : source.split("/").slice(0, -1);
  const segments = [...base];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment !== "..") segments.push(segment);
    else if (segments.pop() === undefined) return null;
  }
  return segments.length === 0 ? null : segments.join("/");
}
