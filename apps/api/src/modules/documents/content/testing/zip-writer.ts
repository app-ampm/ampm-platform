import { crc32, deflateRawSync } from "node:zlib";

/*
 * A small ZIP writer for the content checks' specs: well-formed archives by default, and every field a
 * spec needs to break (names, methods, flags, sizes, CRCs, disks, the end record, bytes around the
 * archive) settable on its own. Test-only: the build leaves `testing/` folders out.
 */

export interface ZipWriterEntry {
  readonly name: string;
  readonly data: Buffer | string;
  /** 8 (deflate, the default) or 0 (stored); any other number is declared but the data stays deflated. */
  readonly method?: number;
  readonly flags?: number;
  readonly localFlags?: number;
  readonly localName?: string;
  readonly localMethod?: number;
  readonly crc?: number;
  readonly localCrc?: number;
  readonly compressedSize?: number;
  readonly uncompressedSize?: number;
  readonly localUncompressedSize?: number;
  /** Writes sizes and CRC in a data descriptor after the data (flag bit 3), zeros in the local header. */
  readonly dataDescriptor?: boolean;
  readonly extra?: Buffer;
  readonly localExtra?: Buffer;
  readonly diskStart?: number;
  /** The stored bytes, used as they are (a hand-made deflate stream, say). */
  readonly rawCompressed?: Buffer;
  /** Leaves the entry out of the central directory, so only its local header remains. */
  readonly hidden?: boolean;
  /** Points the central directory at another entry's local header (by index). */
  readonly centralOffsetOf?: number;
}

export interface ZipWriterOptions {
  readonly prefix?: Buffer;
  readonly suffix?: Buffer;
  readonly comment?: Buffer;
  /** Offsets counted from the first local header instead of the file's start (a "prefixed" ZIP). */
  readonly relativeOffsets?: boolean;
  readonly betweenCentralAndEnd?: Buffer;
  readonly end?: Partial<{
    diskNumber: number;
    centralDisk: number;
    entriesOnDisk: number;
    entries: number;
    centralSize: number;
    centralOffset: number;
    commentLength: number;
  }>;
}

interface Written {
  readonly entry: ZipWriterEntry;
  readonly name: Buffer;
  readonly stored: Buffer;
  readonly crc: number;
  readonly size: number;
  readonly offset: number;
}

const toBuffer = (data: Buffer | string): Buffer =>
  typeof data === "string" ? Buffer.from(data, "utf8") : data;

function storedBytes(entry: ZipWriterEntry, data: Buffer): Buffer {
  if (entry.rawCompressed) return entry.rawCompressed;
  return (entry.method ?? 8) === 0 ? data : deflateRawSync(data);
}

function localHeader(entry: ZipWriterEntry, written: Omit<Written, "offset">): Buffer {
  const name = entry.localName === undefined ? written.name : Buffer.from(entry.localName);
  const extra = entry.localExtra ?? Buffer.alloc(0);
  const header = Buffer.alloc(30);
  const descriptor = entry.dataDescriptor === true;
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(entry.localFlags ?? flagsOf(entry), 6);
  header.writeUInt16LE(entry.localMethod ?? entry.method ?? 8, 8);
  header.writeUInt32LE(descriptor ? 0 : (entry.localCrc ?? written.crc) >>> 0, 14);
  header.writeUInt32LE(descriptor ? 0 : written.stored.length, 18);
  header.writeUInt32LE(descriptor ? 0 : (entry.localUncompressedSize ?? written.size), 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(extra.length, 28);
  return Buffer.concat([header, name, extra]);
}

function flagsOf(entry: ZipWriterEntry): number {
  const utf8 = Buffer.byteLength(entry.name) === entry.name.length ? 0 : 0x0800;
  return (entry.flags ?? utf8) | (entry.dataDescriptor === true ? 0x08 : 0);
}

function descriptorOf(written: Omit<Written, "offset">): Buffer {
  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(written.crc >>> 0, 4);
  descriptor.writeUInt32LE(written.stored.length, 8);
  descriptor.writeUInt32LE(written.size, 12);
  return descriptor;
}

function centralHeader(written: Written, offset: number): Buffer {
  const { entry } = written;
  const extra = entry.extra ?? Buffer.alloc(0);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(flagsOf(entry), 8);
  header.writeUInt16LE(entry.method ?? 8, 10);
  header.writeUInt32LE((entry.crc ?? written.crc) >>> 0, 16);
  header.writeUInt32LE(entry.compressedSize ?? written.stored.length, 20);
  header.writeUInt32LE(entry.uncompressedSize ?? written.size, 24);
  header.writeUInt16LE(written.name.length, 28);
  header.writeUInt16LE(extra.length, 30);
  header.writeUInt16LE(entry.diskStart ?? 0, 34);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, written.name, extra]);
}

function endRecord(options: ZipWriterOptions, count: number, size: number, at: number): Buffer {
  const comment = options.comment ?? Buffer.alloc(0);
  const end = { ...options.end };
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(end.diskNumber ?? 0, 4);
  record.writeUInt16LE(end.centralDisk ?? 0, 6);
  record.writeUInt16LE(end.entriesOnDisk ?? count, 8);
  record.writeUInt16LE(end.entries ?? count, 10);
  record.writeUInt32LE(end.centralSize ?? size, 12);
  record.writeUInt32LE(end.centralOffset ?? at, 16);
  record.writeUInt16LE(end.commentLength ?? comment.length, 20);
  return Buffer.concat([record, comment]);
}

/**
 * A ZIP archive of `entries`, deflated unless an entry says otherwise.
 *
 * @example
 * const zip = writeZip([{ name: "a.txt", data: "Sample Hotel" }]);
 */
export function writeZip(
  entries: readonly ZipWriterEntry[],
  options: ZipWriterOptions = {},
): Buffer {
  const prefix = options.prefix ?? Buffer.alloc(0);
  const base = options.relativeOffsets === true ? 0 : prefix.length;
  const parts: Buffer[] = [prefix];
  const written: Written[] = [];
  let position = base;
  for (const entry of entries) {
    const data = toBuffer(entry.data);
    const draft = {
      entry,
      name: Buffer.from(entry.name, "utf8"),
      stored: storedBytes(entry, data),
      crc: crc32(data),
      size: data.length,
    };
    const local = localHeader(entry, draft);
    const tail = entry.dataDescriptor === true ? descriptorOf(draft) : Buffer.alloc(0);
    parts.push(local, draft.stored, tail);
    written.push({ ...draft, offset: position });
    position += local.length + draft.stored.length + tail.length;
  }
  const listed = written.filter((item) => item.entry.hidden !== true);
  const central = Buffer.concat(
    listed.map((item) => {
      const pointed = item.entry.centralOffsetOf;
      const offset = pointed === undefined ? item.offset : (written[pointed]?.offset ?? 0);
      return centralHeader(item, offset);
    }),
  );
  const between = options.betweenCentralAndEnd ?? Buffer.alloc(0);
  parts.push(central, between, endRecord(options, listed.length, central.length, position));
  parts.push(options.suffix ?? Buffer.alloc(0));
  return Buffer.concat(parts);
}
