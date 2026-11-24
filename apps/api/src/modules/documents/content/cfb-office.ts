import type { ContentKind } from "@ampm/core";

import { type CfbEntry, type CompoundFile, readCompoundFile } from "./cfb.js";
import { wordRefusal } from "./kinds.js";
import { refuse } from "./refusal.js";

/*
 * The older .ppt and .xls (D-187 §2; plan §4.5 "The older .ppt and .xls"). The root's main stream
 * decides the kind: `PowerPoint Document` is a ppt, `Workbook` an xls, and `WordDocument` is Word. Then:
 * encryption (an encrypted package, a workbook's FILEPASS record, an encrypted PowerPoint current-user
 * header or crypt session), VBA and macro storages, and Excel 4 macro sheets are refused. ClamAV's
 * macro alert is the second check.
 */

const MAIN_STREAMS = ["WordDocument", "PowerPoint Document", "Workbook"] as const;
const ENCRYPTED_STORAGES = [
  "EncryptionInfo",
  "EncryptedPackage",
  "\u0006DataSpaces",
  "EncryptedSummary",
];
const MACRO_STORAGES = ["_VBA_PROJECT_CUR", "_VBA_PROJECT", "VBA", "Macros"];

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** BIFF8 record types ([MS-XLS] 2.3). */
const BIFF = { BOF: 0x0809, EOF: 0x000a, FILEPASS: 0x002f, BOUNDSHEET: 0x0085, OBPROJ: 0x00d3 };
/** BoundSheet8.dt: an Excel 4.0 macro sheet, and a VBA module (Excel 5). */
const MACRO_SHEET_TYPES: ReadonlySet<number> = new Set([0x01, 0x06]);
/** BOF.dt of a VBA module's substream (0x0006) and of an Excel 4.0 macro sheet's (0x0040). */
const MACRO_SUBSTREAMS: ReadonlySet<number> = new Set([0x0006, 0x0040]);

/** PowerPoint record types ([MS-PPT] 2.13.24). */
const PPT = {
  VBA_INFO: 0x03ff,
  VBA_INFO_ATOM: 0x0400,
  CRYPT_SESSION: 0x2f14,
  CURRENT_USER: 0x0ff6,
};
const HEADER_TOKEN_PLAIN = 0xe391c05f;
const HEADER_TOKEN_ENCRYPTED = 0xf3d1c4df;

function rootStream(file: CompoundFile, name: string): CfbEntry | undefined {
  return file.entries.find((entry) => entry.depth === 1 && same(entry.name, name));
}

/** Walks a workbook stream's BIFF records: encryption, VBA and Excel 4 macro sheets. */
function checkWorkbook(stream: Buffer): void {
  if (stream.length < 8 || stream.readUInt16LE(0) !== BIFF.BOF) {
    refuse("file_damaged", "a workbook stream that does not start with BOF");
  }
  if (stream.readUInt16LE(4) !== 0x0600) refuse("file_damaged", "a workbook older than Excel 97");
  let at = 0;
  while (at + 4 <= stream.length) {
    const type = stream.readUInt16LE(at);
    const size = stream.readUInt16LE(at + 2);
    if (at + 4 + size > stream.length) refuse("file_damaged", "a workbook record past its stream");
    const data = stream.subarray(at + 4, at + 4 + size);
    if (type === BIFF.FILEPASS) refuse("password_protected", "a workbook with a FILEPASS record");
    if (type === BIFF.OBPROJ) refuse("macros", "a workbook with a VBA project (OBPROJ)");
    if (type === BIFF.BOUNDSHEET && size >= 6 && MACRO_SHEET_TYPES.has(data.readUInt8(5))) {
      refuse("macros", "a workbook with an Excel 4 macro sheet or VBA module");
    }
    if (type === BIFF.BOF && size >= 4 && MACRO_SUBSTREAMS.has(data.readUInt16LE(2))) {
      refuse("macros", "a workbook with an Excel 4 macro sheet or VBA module substream");
    }
    at += 4 + size;
  }
}

/**
 * Visits every record of a PowerPoint stream, descending into containers (recVer 0xF). A record that
 * runs past its container is refused; at the top level, fewer than 8 trailing bytes are padding.
 */
export function walkPptRecords(stream: Buffer, visit: (type: number) => void): void {
  const ends = [stream.length];
  let at = 0;
  while (ends.length > 0) {
    const end = ends[ends.length - 1] ?? 0;
    if (at >= end) {
      ends.pop();
      continue;
    }
    if (at + 8 > end) {
      if (ends.length === 1) return;
      refuse("file_damaged", "a PowerPoint record header cut short");
    }
    const isContainer = (stream.readUInt16LE(at) & 0x0f) === 0x0f;
    const length = stream.readUInt32LE(at + 4);
    if (at + 8 + length > end) refuse("file_damaged", "a PowerPoint record past its container");
    visit(stream.readUInt16LE(at + 2));
    if (isContainer) ends.push(at + 8 + length);
    at += isContainer ? 8 : 8 + length;
  }
}

function checkPresentation(file: CompoundFile, document: CfbEntry): void {
  const currentUser = rootStream(file, "Current User");
  if (!currentUser || currentUser.type !== "stream")
    refuse("file_damaged", "no Current User stream");
  const user = file.read(currentUser);
  if (user.length < 16 || user.readUInt16LE(2) !== PPT.CURRENT_USER) {
    refuse("file_damaged", "a malformed Current User stream");
  }
  const token = user.readUInt32LE(12);
  if (token === HEADER_TOKEN_ENCRYPTED) refuse("password_protected", "an encrypted presentation");
  if (token !== HEADER_TOKEN_PLAIN) refuse("file_damaged", "an unknown current-user header token");
  walkPptRecords(file.read(document), (type) => {
    if (type === PPT.VBA_INFO || type === PPT.VBA_INFO_ATOM) {
      refuse("macros", "a presentation with a VBA project");
    }
    if (type === PPT.CRYPT_SESSION) refuse("password_protected", "an encrypted presentation");
  });
}

/** The main stream decides the kind; two main streams are two types at once. */
function mainStream(file: CompoundFile, accepted: ReadonlySet<ContentKind>) {
  const found = MAIN_STREAMS.map((name) => rootStream(file, name)).filter(
    (entry): entry is CfbEntry => entry !== undefined,
  );
  if (found.length > 1) refuse("polyglot", "a compound file with two main streams");
  const [main] = found;
  if (!main) return refuse("unknown_type", "a compound file that is not PowerPoint or Excel");
  if (main.type !== "stream") refuse("file_damaged", "a main stream stored as a storage");
  if (same(main.name, "WordDocument")) refuse(wordRefusal(accepted), "a Word document");
  const kind: "ppt" | "xls" = same(main.name, "Workbook") ? "xls" : "ppt";
  if (!accepted.has(kind)) refuse("type_not_accepted", `a ${kind}`);
  return { main, kind };
}

/**
 * The kind of an older PowerPoint or Excel file after every compound file rule, or a refusal.
 *
 * @example
 * inspectCompoundFile(bytes, new Set(["xls", "pdf"])); // "xls"
 */
export function inspectCompoundFile(
  bytes: Buffer,
  accepted: ReadonlySet<ContentKind>,
): "ppt" | "xls" {
  const file = readCompoundFile(bytes);
  const roots = file.entries.filter((entry) => entry.depth === 1);
  if (roots.some((entry) => ENCRYPTED_STORAGES.some((name) => same(entry.name, name)))) {
    refuse("password_protected", "an encrypted Office file");
  }
  const { main, kind } = mainStream(file, accepted);
  const macro = file.entries.find((entry) => MACRO_STORAGES.some((name) => same(entry.name, name)));
  if (macro) refuse("macros", "a VBA or macro storage");
  if (kind === "xls") checkWorkbook(file.read(main));
  else checkPresentation(file, main);
  return kind;
}
