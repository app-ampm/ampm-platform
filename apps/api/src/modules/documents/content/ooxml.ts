import type { ContentKind, UploadRefusalReason } from "@ampm/core";

import { type OoxmlKind, wordRefusal } from "./kinds.js";
import {
  contentTypeOf,
  type ContentTypes,
  forEachRelationship,
  parseContentTypes,
  type Relationship,
  resolveTarget,
  sourceOfRels,
} from "./ooxml-parts.js";
import {
  isEmbeddedPackage,
  isOfficeDocument,
  isScannedXml,
  mainPartOf,
  type MainPart,
  refuseContentType,
  refuseRelationship,
} from "./ooxml-rules.js";
import { partScanner } from "./ooxml-scan.js";
import { ContentRefusal, refuse } from "./refusal.js";
import { CFB_SIGNATURE, ZIP_LOCAL_SIGNATURE } from "./sniff.js";
import { readZip, type ZipEntry } from "./zip.js";
import { ExpansionBudget, inflateEntry, readEntry } from "./zip-inflate.js";
import { opcKey } from "./zip-names.js";

/*
 * The OOXML check (D-187 §2; plan §4.5 "The OOXML check"). The main part named by the package
 * relationship decides the kind; then every relationship, every content type and every XML part is
 * checked, and an embedded package (a chart's workbook) passes the same checks one level deep.
 */

interface OpenPackage {
  readonly entries: readonly ZipEntry[];
  readonly byKey: ReadonlyMap<string, ZipEntry>;
  readonly types: ContentTypes;
  readonly main: MainPart;
  /** The package relationships (at most 2 MiB), kept for their rules until the kind is decided. */
  readonly rootRels: Buffer;
  /** The parts read whole so far, by OPC key: never read twice, never scanned again as content. */
  readonly done: Set<string>;
}

/** The kinds an embedded package may be: a non-macro workbook or presentation. */
const EMBEDDABLE: ReadonlySet<OoxmlKind> = new Set(["xlsx", "xltx", "pptx", "ppsx", "potx"]);

/**
 * A part read whole (at most 2 MiB) the first time it is asked for; null when the package has no such part
 * or it was read already. Nothing keeps the bytes: the caller parses them and lets them go.
 */
async function readPart(
  bytes: Buffer,
  open: Pick<OpenPackage, "byKey" | "done">,
  name: string,
  budget: ExpansionBudget,
  overCap: UploadRefusalReason,
): Promise<Buffer | null> {
  const key = opcKey(name);
  const entry = open.byKey.get(key);
  if (!entry || open.done.has(key)) return null;
  open.done.add(key);
  return readEntry(bytes, entry, budget, overCap);
}

/** The target of the one main part relationship among the package relationships, or the refusal. */
function mainTarget(rootRels: Buffer): string {
  const found = { count: 0, target: "" };
  forEachRelationship(rootRels, "_rels/.rels", (relationship) => {
    if (!isOfficeDocument(relationship.type)) return;
    found.count += 1;
    if (found.count === 1) found.target = relationship.target;
  });
  if (found.count !== 1) {
    refuse(found.count === 0 ? "unknown_type" : "archive_unsafe", `${found.count} main parts`);
  }
  return found.target;
}

/** Reads the content types and the package relationships, and finds the main part. */
async function openPackage(bytes: Buffer, budget: ExpansionBudget): Promise<OpenPackage> {
  const entries = readZip(bytes);
  const byKey = new Map(entries.map((entry) => [opcKey(entry.name), entry]));
  const done = new Set<string>();
  const read = (name: string): Promise<Buffer | null> =>
    readPart(bytes, { byKey, done }, name, budget, "archive_unsafe");
  const typesXml = await read("[Content_Types].xml");
  const rootRels = await read("_rels/.rels");
  if (!typesXml || !rootRels) refuse("unknown_type", "a ZIP that is not an Office package");
  const types = parseContentTypes(typesXml);
  const mainName = resolveTarget("", mainTarget(rootRels));
  if (mainName === null || !byKey.has(opcKey(mainName))) refuse("file_damaged", "no main part");
  const main = mainPartOf(contentTypeOf(types, mainName) ?? "");
  if (main === null) refuse("unknown_type", `a package whose main part is ${mainName}`);
  return { entries, byKey, types, main, rootRels, done };
}

/** The kind a main part makes the package for this upload, or the refusal. */
function acceptedKind(main: MainPart, accepted: ReadonlySet<ContentKind>): OoxmlKind {
  if ("word" in main) return refuse(wordRefusal(accepted), "a Word document");
  if ("macroOf" in main) {
    const reason = accepted.has(main.macroOf) ? "macros" : "type_not_accepted";
    return refuse(reason, `a macro-enabled ${main.macroOf}`);
  }
  if (!accepted.has(main.kind)) refuse("type_not_accepted", `a ${main.kind}`);
  return main.kind;
}

/**
 * Applies the relationship rules to the package relationships, then to every other relationship part, each
 * read once and let go; returns the embedded packages.
 */
async function checkRelationships(
  bytes: Buffer,
  open: OpenPackage,
  budget: ExpansionBudget,
): Promise<Set<string>> {
  const embedded = new Set<string>();
  const check = (relationship: Relationship): void => {
    refuseRelationship(relationship);
    if (!isEmbeddedPackage(relationship.type)) return;
    const target = resolveTarget(relationship.source, relationship.target);
    if (target === null) refuse("archive_unsafe", `an embedded package outside the package`);
    embedded.add(opcKey(target));
  };
  forEachRelationship(open.rootRels, "_rels/.rels", check);
  for (const entry of open.entries) {
    if (sourceOfRels(entry.name) === null) continue;
    const xml = await readPart(bytes, open, entry.name, budget, "archive_unsafe");
    if (xml) forEachRelationship(xml, entry.name, check);
  }
  return embedded;
}

/** Refuses a part that is itself a ZIP or a compound file without being linked as an embedded package. */
function firstBytesSink(name: string): (chunk: Buffer) => void {
  let head = Buffer.alloc(0);
  return (chunk) => {
    if (head.length >= 8) return;
    head = Buffer.concat([head, chunk.subarray(0, 8 - head.length)]);
    if (head.length < 4) return;
    if (head.subarray(0, 4).equals(ZIP_LOCAL_SIGNATURE))
      refuse("active_content", `a hidden package ${name}`);
    if (head.length >= 8 && head.equals(CFB_SIGNATURE))
      refuse("active_content", `an OLE object ${name}`);
  };
}

async function checkPart(
  bytes: Buffer,
  open: OpenPackage,
  entry: ZipEntry,
  budget: ExpansionBudget,
  depth: number,
  embedded: ReadonlySet<string>,
): Promise<void> {
  const key = opcKey(entry.name);
  if (entry.isFolder || open.done.has(key)) return;
  const contentType = contentTypeOf(open.types, entry.name) ?? "";
  if (embedded.has(key)) {
    if (depth > 0) refuse("active_content", `a package inside an embedded package: ${entry.name}`);
    const inner = await readPart(bytes, open, entry.name, budget, "active_content");
    if (inner) await checkEmbedded(inner, budget, entry.name);
  } else if (isScannedXml(contentType)) {
    const scanner = partScanner(entry.name);
    await inflateEntry(bytes, entry, budget, (chunk) => scanner.write(chunk));
    scanner.end();
  } else {
    await inflateEntry(bytes, entry, budget, firstBytesSink(entry.name));
  }
}

/** Every rule after the kind: content types, relationships, then each part's content. */
async function checkPackage(
  bytes: Buffer,
  open: OpenPackage,
  budget: ExpansionBudget,
  depth: number,
) {
  for (const entry of open.entries) {
    if (entry.isFolder || opcKey(entry.name) === "[content_types].xml") continue;
    const contentType = contentTypeOf(open.types, entry.name);
    if (contentType === null)
      refuse("archive_unsafe", `a part with no content type: ${entry.name}`);
    refuseContentType(entry.name, contentType);
  }
  const embedded = await checkRelationships(bytes, open, budget);
  for (const entry of open.entries) await checkPart(bytes, open, entry, budget, depth, embedded);
}

/** Opens an embedded package; one that is not an Office package is an embedded object, not a type. */
async function openEmbedded(inner: Buffer, budget: ExpansionBudget, name: string) {
  const notOffice = (): never =>
    refuse("active_content", `an embedded package that is not an Office package: ${name}`);
  if (!inner.subarray(0, 4).equals(ZIP_LOCAL_SIGNATURE)) notOffice();
  try {
    return await openPackage(inner, budget);
  } catch (error) {
    if (error instanceof ContentRefusal && error.reason === "unknown_type") notOffice();
    throw error;
  }
}

/** An embedded package must be a non-macro workbook or presentation that passes every check. */
async function checkEmbedded(inner: Buffer, budget: ExpansionBudget, name: string): Promise<void> {
  const open = await openEmbedded(inner, budget, name);
  if ("macroOf" in open.main) refuse("macros", `a macro-enabled embedded package: ${name}`);
  if (!("kind" in open.main) || !EMBEDDABLE.has(open.main.kind)) {
    refuse("active_content", `an embedded package that is not a workbook or presentation: ${name}`);
  }
  await checkPackage(inner, open, budget, 1);
}

/**
 * The kind of an Office package, after every OOXML rule, or a refusal. A kind this upload does not take
 * is refused before any part other than the content types and the package relationships is inflated.
 *
 * @example
 * const kind = await inspectOoxml(bytes, new Set(["pptx", "pdf"])); // "pptx"
 */
export async function inspectOoxml(
  bytes: Buffer,
  accepted: ReadonlySet<ContentKind>,
): Promise<OoxmlKind> {
  const budget = new ExpansionBudget();
  const open = await openPackage(bytes, budget);
  const kind = acceptedKind(open.main, accepted);
  await checkPackage(bytes, open, budget, 0);
  return kind;
}
