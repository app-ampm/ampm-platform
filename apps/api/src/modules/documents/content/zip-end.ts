/*
 * The ZIP end of central directory record (APPNOTE 4.3.16): where a ZIP reader starts. The ZIP reader
 * needs exactly one, ending the file; the polyglot rule needs to know whether a non-ZIP file carries one a
 * ZIP reader would accept (D-187 §2). Both search only the last 64 KiB plus the record itself, which is as
 * far back as a record can sit behind its comment.
 */

export const END_SIGNATURE = 0x06054b50;
export const CENTRAL_SIGNATURE = 0x02014b50;
export const END_RECORD_BYTES = 22;
const MAX_COMMENT_BYTES = 0xffff;
const END_NEEDLE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

export interface EndRecord {
  readonly offset: number;
  readonly diskNumber: number;
  readonly centralDisk: number;
  readonly entriesOnDisk: number;
  readonly entries: number;
  readonly centralSize: number;
  readonly centralOffset: number;
  readonly commentLength: number;
}

function readEnd(bytes: Buffer, offset: number): EndRecord {
  return {
    offset,
    diskNumber: bytes.readUInt16LE(offset + 4),
    centralDisk: bytes.readUInt16LE(offset + 6),
    entriesOnDisk: bytes.readUInt16LE(offset + 8),
    entries: bytes.readUInt16LE(offset + 10),
    centralSize: bytes.readUInt32LE(offset + 12),
    centralOffset: bytes.readUInt32LE(offset + 16),
    commentLength: bytes.readUInt16LE(offset + 20),
  };
}

/**
 * Every end record signature in the last 64 KiB whose comment fits inside the file, latest first. Only
 * that window is searched (a search of the whole buffer would run back to its start when the window holds
 * no signature), so the work is at most 65,557 bytes whatever the file's size.
 */
export function endRecordCandidates(bytes: Buffer): EndRecord[] {
  const windowStart = Math.max(0, bytes.length - END_RECORD_BYTES - MAX_COMMENT_BYTES);
  const window = bytes.subarray(windowStart);
  const found: EndRecord[] = [];
  let at = window.length - END_RECORD_BYTES;
  while (at >= 0) {
    at = window.lastIndexOf(END_NEEDLE, at);
    if (at < 0) break;
    const record = readEnd(bytes, windowStart + at);
    if (record.offset + END_RECORD_BYTES + record.commentLength <= bytes.length) found.push(record);
    at -= 1;
  }
  return found;
}

/**
 * True when a ZIP reader would open `record`: one disk, at least one entry, and a central directory
 * header where the record says, or where it sits counting back from the record (the "prefixed" ZIPs that
 * self-extractors and polyglots rely on, which most readers follow).
 */
export function isUsableEndRecord(bytes: Buffer, record: EndRecord): boolean {
  if (record.entries === 0 || record.entriesOnDisk !== record.entries) return false;
  if (record.diskNumber !== 0 && record.diskNumber !== 0xffff) return false;
  const centralAt = (offset: number): boolean =>
    offset >= 0 && offset + 4 <= record.offset && bytes.readUInt32LE(offset) === CENTRAL_SIGNATURE;
  return centralAt(record.centralOffset) || centralAt(record.offset - record.centralSize);
}

/** True when a ZIP reader would find a ZIP in the last 64 KiB of `bytes`. */
export function hasUsableEndRecord(bytes: Buffer): boolean {
  if (bytes.length < END_RECORD_BYTES) return false;
  return endRecordCandidates(bytes).some((record) => isUsableEndRecord(bytes, record));
}
