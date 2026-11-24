import { need, refuse } from "./refusal.js";
import {
  CENTRAL_SIGNATURE,
  END_RECORD_BYTES,
  endRecordCandidates,
  type EndRecord,
} from "./zip-end.js";
import { refuseDuplicateNames, refuseUnsafeName } from "./zip-names.js";

/*
 * The ZIP reader (D-187 §2): the central directory under a byte bound, every local header checked against
 * it, and the archive's extent checked against the file's. It reads structure only; zip-inflate.ts reads
 * the data. Everything a ZIP may do that Office never writes is refused: ZIP64, more than 5,000 entries,
 * several disks, encryption, methods other than stored and deflate, odd or duplicate names, local headers
 * that say something else, overlapping entries, and bytes before the first entry or after the end record.
 */

export const MAX_ZIP_ENTRIES = 5000;
const LOCAL_SIGNATURE = 0x04034b50;
const DESCRIPTOR_SIGNATURE = 0x08074b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EXTRA = 0x0001;
const FLAG_DESCRIPTOR = 0x0008;
const FLAG_UTF8 = 0x0800;
/** Encrypted (bit 0), strong encryption (bit 6) and a masked local header (bit 13). */
const ENCRYPTION_FLAGS = 0x0001 | 0x0040 | 0x2000;
const WINZIP_AES = 99;
const MAX_32 = 0xffffffff;

export interface ZipEntry {
  readonly name: string;
  readonly method: 0 | 8;
  readonly flags: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localOffset: number;
  /** Where the stored bytes start and end, after the local header and before any data descriptor. */
  readonly dataStart: number;
  readonly dataEnd: number;
  /** One past the entry's last byte, its data descriptor included. */
  readonly end: number;
  readonly isFolder: boolean;
}

interface CentralEntry {
  readonly name: string;
  readonly rawName: Buffer;
  readonly method: 0 | 8;
  readonly flags: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localOffset: number;
  readonly next: number;
}

/** The one end record that ends the file; bytes after it, or two candidates, are refused. */
function findEnd(bytes: Buffer): EndRecord {
  const candidates = endRecordCandidates(bytes);
  const exact = candidates.filter(
    (record) => record.offset + END_RECORD_BYTES + record.commentLength === bytes.length,
  );
  if (exact.length > 1) refuse("archive_unsafe", "two end records that both end the file");
  const [record] = exact;
  if (record) return record;
  if (candidates.length > 0) refuse("polyglot", "bytes after the ZIP end record");
  return refuse("file_damaged", "no ZIP end record");
}

function refuseOddEnd(bytes: Buffer, end: EndRecord): void {
  const zip64 =
    end.entries === 0xffff ||
    end.centralSize === MAX_32 ||
    end.centralOffset === MAX_32 ||
    (end.offset >= 20 && bytes.readUInt32LE(end.offset - 20) === ZIP64_LOCATOR_SIGNATURE);
  if (zip64) refuse("archive_unsafe", "a ZIP64 archive");
  if (end.diskNumber !== 0 || end.centralDisk !== 0 || end.entriesOnDisk !== end.entries) {
    refuse("archive_unsafe", "an archive on several disks");
  }
  if (end.entries > MAX_ZIP_ENTRIES) refuse("archive_unsafe", `${end.entries} entries`);
  if (end.entries === 0) refuse("file_damaged", "an archive with no entries");
  if (end.centralOffset + end.centralSize !== end.offset) {
    refuse("archive_unsafe", "bytes between the central directory and the end record");
  }
}

function hasZip64Extra(extra: Buffer): boolean {
  for (let at = 0; at + 4 <= extra.length; at += 4 + extra.readUInt16LE(at + 2)) {
    if (extra.readUInt16LE(at) === ZIP64_EXTRA) return true;
  }
  return false;
}

function refuseOddCentral(flags: number, method: number, sizes: number[], extra: Buffer): void {
  if ((flags & ENCRYPTION_FLAGS) !== 0 || method === WINZIP_AES) {
    refuse("password_protected", "an encrypted entry");
  }
  if (method !== 0 && method !== 8) refuse("archive_unsafe", `compression method ${method}`);
  if (sizes.includes(MAX_32) || hasZip64Extra(extra)) refuse("archive_unsafe", "a ZIP64 entry");
}

/**
 * A name as UTF-8 when the UTF-8 flag is set or its bytes are valid UTF-8, otherwise byte by byte. Reading
 * valid UTF-8 as UTF-8 even without the flag compares names the way a UTF-8 reader would see them.
 */
function decodeName(rawName: Buffer, flags: number): string {
  const utf8 = rawName.toString("utf8");
  const isUtf8 = (flags & FLAG_UTF8) !== 0 || Buffer.from(utf8, "utf8").equals(rawName);
  return isUtf8 ? utf8 : rawName.toString("latin1");
}

function readCentralEntry(bytes: Buffer, at: number, limit: number): CentralEntry {
  if (at + 46 > limit || bytes.readUInt32LE(at) !== CENTRAL_SIGNATURE) {
    refuse("file_damaged", "a central directory header missing or cut short");
  }
  const flags = bytes.readUInt16LE(at + 8);
  const method = bytes.readUInt16LE(at + 10);
  const nameEnd = at + 46 + bytes.readUInt16LE(at + 28);
  const extraEnd = nameEnd + bytes.readUInt16LE(at + 30);
  const next = extraEnd + bytes.readUInt16LE(at + 32);
  if (next > limit) refuse("file_damaged", "a central directory header past its end");
  if (bytes.readUInt16LE(at + 34) !== 0) refuse("archive_unsafe", "an entry on another disk");
  const [compressedSize = 0, uncompressedSize = 0, localOffset = 0] = [20, 24, 42].map((field) =>
    bytes.readUInt32LE(at + field),
  );
  const extra = bytes.subarray(nameEnd, extraEnd);
  refuseOddCentral(flags, method, [compressedSize, uncompressedSize, localOffset], extra);
  const rawName = bytes.subarray(at + 46, nameEnd);
  const name = decodeName(rawName, flags);
  refuseUnsafeName(name);
  if (name.endsWith("/") && uncompressedSize !== 0) refuse("archive_unsafe", "a folder with data");
  const crc = bytes.readUInt32LE(at + 16);
  const kept = { name, rawName, flags, crc, compressedSize, uncompressedSize, localOffset };
  return { ...kept, method: method === 0 ? 0 : 8, next };
}

function readCentral(bytes: Buffer, end: EndRecord): CentralEntry[] {
  need(bytes, end.centralOffset, end.centralSize, "the central directory");
  const entries: CentralEntry[] = [];
  let at = end.centralOffset;
  for (let index = 0; index < end.entries; index += 1) {
    const entry = readCentralEntry(bytes, at, end.offset);
    entries.push(entry);
    at = entry.next;
  }
  if (at !== end.offset) refuse("archive_unsafe", "central directory bytes the end record omits");
  return entries;
}

/** Checks a data descriptor (with or without its signature) against the central directory. */
function descriptorEnd(bytes: Buffer, entry: CentralEntry, dataEnd: number): number {
  const signed =
    dataEnd + 4 <= bytes.length && bytes.readUInt32LE(dataEnd) === DESCRIPTOR_SIGNATURE;
  const fields = signed ? dataEnd + 4 : dataEnd;
  need(bytes, fields, 12, "a data descriptor");
  const same =
    bytes.readUInt32LE(fields) === entry.crc &&
    bytes.readUInt32LE(fields + 4) === entry.compressedSize &&
    bytes.readUInt32LE(fields + 8) === entry.uncompressedSize;
  if (!same) refuse("archive_unsafe", `a data descriptor that differs for ${entry.name}`);
  return fields + 12;
}

/** True when the local header names, packs or sizes the entry differently from the central directory. */
function localDiffers(bytes: Buffer, entry: CentralEntry, nameEnd: number): boolean {
  const at = entry.localOffset;
  const flags = bytes.readUInt16LE(at + 6);
  if ((flags & ENCRYPTION_FLAGS) !== 0) refuse("password_protected", "an encrypted local entry");
  const deferred = (flags & FLAG_DESCRIPTOR) !== 0;
  const sizesDiffer =
    !deferred &&
    (bytes.readUInt32LE(at + 14) !== entry.crc ||
      bytes.readUInt32LE(at + 18) !== entry.compressedSize ||
      bytes.readUInt32LE(at + 22) !== entry.uncompressedSize);
  return (
    sizesDiffer ||
    !bytes.subarray(at + 30, nameEnd).equals(entry.rawName) ||
    bytes.readUInt16LE(at + 8) !== entry.method ||
    deferred !== ((entry.flags & FLAG_DESCRIPTOR) !== 0)
  );
}

function withLocal(bytes: Buffer, entry: CentralEntry): ZipEntry {
  const at = entry.localOffset;
  need(bytes, at, 30, `the local header of ${entry.name}`);
  if (bytes.readUInt32LE(at) !== LOCAL_SIGNATURE)
    refuse("archive_unsafe", "a missing local header");
  const nameEnd = at + 30 + bytes.readUInt16LE(at + 26);
  const dataStart = nameEnd + bytes.readUInt16LE(at + 28);
  need(bytes, at, dataStart - at + entry.compressedSize, `the data of ${entry.name}`);
  if (localDiffers(bytes, entry, nameEnd)) {
    refuse("archive_unsafe", `a local header that differs for ${entry.name}`);
  }
  if (entry.method === 0 && entry.compressedSize !== entry.uncompressedSize) {
    refuse("file_damaged", `a stored entry whose sizes differ: ${entry.name}`);
  }
  const dataEnd = dataStart + entry.compressedSize;
  const deferred = (entry.flags & FLAG_DESCRIPTOR) !== 0;
  const { name, method, flags, crc, compressedSize, uncompressedSize, localOffset } = entry;
  return {
    ...{ name, method, flags, crc, compressedSize, uncompressedSize, localOffset },
    ...{ dataStart, dataEnd, isFolder: name.endsWith("/") },
    end: deferred ? descriptorEnd(bytes, entry, dataEnd) : dataEnd,
  };
}

/** Refuses entries that overlap each other or the central directory, and bytes before the first. */
function refuseLayout(entries: readonly ZipEntry[], centralOffset: number): void {
  const ordered = [...entries].sort((a, b) => a.localOffset - b.localOffset);
  if ((ordered[0]?.localOffset ?? 0) !== 0)
    refuse("polyglot", "bytes before the first local header");
  ordered.forEach((entry, index) => {
    const next = ordered[index + 1]?.localOffset ?? centralOffset;
    if (entry.end > next) refuse("archive_unsafe", `an entry overlapping another: ${entry.name}`);
  });
}

/**
 * The entries of a ZIP archive, after every structural rule. The data is not read here.
 *
 * @example
 * const entries = readZip(bytes); // throws a ContentRefusal for an archive Office never writes
 */
export function readZip(bytes: Buffer): ZipEntry[] {
  const end = findEnd(bytes);
  refuseOddEnd(bytes, end);
  const central = readCentral(bytes, end);
  refuseDuplicateNames(central.map((entry) => entry.name));
  const entries = central.map((entry) => withLocal(bytes, entry));
  refuseLayout(entries, end.centralOffset);
  return entries;
}
