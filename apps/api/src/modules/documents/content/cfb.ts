import { need, refuse } from "./refusal.js";

/*
 * The compound file reader for the older .ppt and .xls (D-187 §2; [MS-CFB]). The header, the FAT, the
 * DIFAT, the directory and the mini stream are read under the file's own bounds: every sector number is
 * checked against the file, every chain is walked with a visited map so a loop stops it, and the
 * directory tree is walked once per entry. Streams are read only when a rule needs them.
 */

const END_OF_CHAIN = 0xfffffffe;
const NO_ENTRY = 0xffffffff;
const HEADER_DIFAT_ENTRIES = 109;
const ENTRY_BYTES = 128;
const MINI_SECTOR_BYTES = 64;
const MINI_STREAM_CUTOFF = 4096;
const MAX_TREE_DEPTH = 32;

export type CfbEntryType = "storage" | "stream";

export interface CfbEntry {
  readonly id: number;
  readonly name: string;
  readonly type: CfbEntryType;
  readonly start: number;
  readonly size: number;
  /** 1 for the root's children, 2 for theirs, and so on. */
  readonly depth: number;
}

interface Header {
  readonly major: number;
  readonly sectorSize: number;
  readonly sectorCount: number;
  readonly fatSectors: number;
  readonly firstDirectory: number;
  readonly firstMiniFat: number;
  readonly miniFatSectors: number;
  readonly firstDifat: number;
  readonly difatSectors: number;
}

interface RawEntry {
  readonly name: string;
  readonly kind: number;
  readonly left: number;
  readonly right: number;
  readonly child: number;
  readonly start: number;
  readonly size: number;
}

const damaged = (what: string): never => refuse("file_damaged", `a compound file with ${what}`);

function readHeader(bytes: Buffer): Header {
  need(bytes, 0, 512, "the compound file header");
  const major = bytes.readUInt16LE(26);
  const shift = bytes.readUInt16LE(30);
  const versionOk = (major === 3 && shift === 9) || (major === 4 && shift === 12);
  if (bytes.readUInt16LE(28) !== 0xfffe || !versionOk) damaged("an unknown version or byte order");
  if (bytes.readUInt16LE(32) !== 6 || bytes.readUInt32LE(56) !== MINI_STREAM_CUTOFF) {
    damaged("an unknown mini stream layout");
  }
  const sectorSize = 1 << shift;
  if (bytes.length < sectorSize * 2) damaged("no sectors");
  return {
    major,
    sectorSize,
    sectorCount: Math.ceil((bytes.length - sectorSize) / sectorSize),
    fatSectors: bytes.readUInt32LE(44),
    firstDirectory: bytes.readUInt32LE(48),
    firstMiniFat: bytes.readUInt32LE(60),
    miniFatSectors: bytes.readUInt32LE(64),
    firstDifat: bytes.readUInt32LE(68),
    difatSectors: bytes.readUInt32LE(72),
  };
}

/** A whole sector, which must lie inside the file. */
function fullSector(bytes: Buffer, header: Header, sector: number): Buffer {
  if (sector >= header.sectorCount) damaged(`sector ${sector} outside the file`);
  const offset = (sector + 1) * header.sectorSize;
  need(bytes, offset, header.sectorSize, `sector ${sector}`);
  return bytes.subarray(offset, offset + header.sectorSize);
}

/** The FAT's sector numbers: the header's 109, then the DIFAT chain's, with a loop check. */
function fatSectorNumbers(bytes: Buffer, header: Header): number[] {
  if (header.fatSectors > header.sectorCount) damaged("more FAT sectors than sectors");
  const numbers: number[] = [];
  for (let index = 0; index < Math.min(HEADER_DIFAT_ENTRIES, header.fatSectors); index += 1) {
    numbers.push(bytes.readUInt32LE(76 + index * 4));
  }
  const perSector = header.sectorSize / 4 - 1;
  const seen = new Set<number>();
  let difat = header.firstDifat;
  while (numbers.length < header.fatSectors) {
    if (seen.has(difat) || seen.size >= header.difatSectors) damaged("a DIFAT chain that loops");
    seen.add(difat);
    const sector = fullSector(bytes, header, difat);
    for (let index = 0; index < perSector && numbers.length < header.fatSectors; index += 1) {
      numbers.push(sector.readUInt32LE(index * 4));
    }
    difat = sector.readUInt32LE(header.sectorSize - 4);
  }
  return numbers;
}

function readFat(bytes: Buffer, header: Header): Uint32Array {
  const perSector = header.sectorSize / 4;
  const numbers = fatSectorNumbers(bytes, header);
  const fat = new Uint32Array(numbers.length * perSector);
  numbers.forEach((number, index) => {
    const sector = fullSector(bytes, header, number);
    for (let entry = 0; entry < perSector; entry += 1) {
      fat[index * perSector + entry] = sector.readUInt32LE(entry * 4);
    }
  });
  return fat;
}

/**
 * The sectors of a chain, at most `limit` of them, among `count` sectors: refused when it loops or leaves
 * the file or the table. A caller that needs `limit` sectors checks the length it gets back.
 */
export function walkChain(
  table: Uint32Array,
  start: number,
  limit: number,
  count: number,
): number[] {
  const chain: number[] = [];
  const seen = new Uint8Array(count);
  let sector = start;
  while (sector !== END_OF_CHAIN && chain.length < limit) {
    if (sector >= count || sector >= table.length || seen[sector] === 1) {
      damaged("a sector chain that loops or leaves the file");
    }
    seen[sector] = 1;
    chain.push(sector);
    sector = table[sector] ?? END_OF_CHAIN;
  }
  return chain;
}

function readRawEntry(directory: Buffer, index: number, major: number): RawEntry {
  const at = index * ENTRY_BYTES;
  const nameLength = directory.readUInt16LE(at + 64);
  const kind = directory.readUInt8(at + 66);
  if (kind !== 0 && (nameLength > 64 || nameLength % 2 !== 0)) damaged("a malformed entry name");
  const high = directory.readUInt32LE(at + 124);
  if (major === 4 && high !== 0 && kind !== 0) damaged("a stream over 4 GiB");
  return {
    name: directory.toString("utf16le", at, at + Math.max(0, nameLength - 2)),
    kind,
    left: directory.readUInt32LE(at + 68),
    right: directory.readUInt32LE(at + 72),
    child: directory.readUInt32LE(at + 76),
    start: directory.readUInt32LE(at + 116),
    size: directory.readUInt32LE(at + 120),
  };
}

function readDirectory(bytes: Buffer, header: Header, fat: Uint32Array): RawEntry[] {
  const sectors = walkChain(fat, header.firstDirectory, header.sectorCount, header.sectorCount);
  const directory = Buffer.concat(sectors.map((sector) => fullSector(bytes, header, sector)));
  const count = directory.length / ENTRY_BYTES;
  const entries = Array.from({ length: count }, (_, index) =>
    readRawEntry(directory, index, header.major),
  );
  if (entries[0]?.kind !== 5) damaged("no root entry");
  return entries;
}

/** Every entry under the root, each reached once: a loop or a shared entry is refused. */
function walkTree(raw: readonly RawEntry[], length: number): CfbEntry[] {
  const visited = new Uint8Array(raw.length);
  const found: CfbEntry[] = [];
  const stack: Array<{ id: number; depth: number }> = [{ id: raw[0]?.child ?? NO_ENTRY, depth: 1 }];
  while (stack.length > 0) {
    const { id, depth } = stack.pop() ?? { id: NO_ENTRY, depth: 0 };
    if (id === NO_ENTRY) continue;
    const entry = raw[id];
    if (!entry || visited[id] === 1 || depth > MAX_TREE_DEPTH) damaged("a directory that loops");
    visited[id] = 1;
    if (entry.kind !== 1 && entry.kind !== 2) damaged("a directory entry of an unknown type");
    if (entry.kind === 2 && entry.size > length) damaged("a stream larger than the file");
    stack.push({ id: entry.left, depth }, { id: entry.right, depth });
    if (entry.kind === 1) stack.push({ id: entry.child, depth: depth + 1 });
    const type: CfbEntryType = entry.kind === 1 ? "storage" : "stream";
    found.push({ id, name: entry.name, type, start: entry.start, size: entry.size, depth });
  }
  return found;
}

export interface CompoundFile {
  /** Every storage and stream under the root, at any depth. */
  readonly entries: readonly CfbEntry[];
  /** A stream's bytes, exactly its size. */
  read(entry: CfbEntry): Buffer;
}

function streamReader(bytes: Buffer, header: Header, fat: Uint32Array, root: RawEntry) {
  const regular = (start: number, size: number): Buffer => {
    const needed = Math.ceil(size / header.sectorSize);
    const chain = walkChain(fat, start, needed, header.sectorCount);
    if (chain.length < needed) damaged("a stream shorter than its size");
    const parts = chain.map((sector) => {
      const offset = (sector + 1) * header.sectorSize;
      return bytes.subarray(offset, Math.min(offset + header.sectorSize, bytes.length));
    });
    const data = Buffer.concat(parts);
    if (data.length < size) damaged("a stream cut short by the end of the file");
    return data.subarray(0, size);
  };
  let mini: { stream: Buffer; table: Uint32Array } | null = null;
  const miniParts = () => {
    if (mini) return mini;
    const tableBytes = regular(header.firstMiniFat, header.miniFatSectors * header.sectorSize);
    const table = new Uint32Array(tableBytes.length / 4).map((_, index) =>
      tableBytes.readUInt32LE(index * 4),
    );
    mini = { stream: regular(root.start, root.size), table };
    return mini;
  };
  return (entry: CfbEntry): Buffer => {
    if (entry.size >= MINI_STREAM_CUTOFF) return regular(entry.start, entry.size);
    const { stream, table } = miniParts();
    const needed = Math.ceil(entry.size / MINI_SECTOR_BYTES);
    const sectors = Math.floor(stream.length / MINI_SECTOR_BYTES);
    const chain = walkChain(table, entry.start, needed, sectors);
    if (chain.length < needed) damaged("a mini stream shorter than its size");
    const data = Buffer.concat(
      chain.map((sector) =>
        stream.subarray(sector * MINI_SECTOR_BYTES, (sector + 1) * MINI_SECTOR_BYTES),
      ),
    );
    return data.subarray(0, entry.size);
  };
}

/**
 * The structure of a compound file, or a refusal when it is damaged, looping or out of bounds.
 *
 * @example
 * const file = readCompoundFile(bytes);
 * const workbook = file.entries.find((entry) => entry.name === "Workbook");
 */
export function readCompoundFile(bytes: Buffer): CompoundFile {
  const header = readHeader(bytes);
  const fat = readFat(bytes, header);
  const raw = readDirectory(bytes, header, fat);
  const entries = walkTree(raw, bytes.length);
  const root = raw[0] ?? damaged("no root entry");
  if (root.size > bytes.length) damaged("a mini stream larger than the file");
  return { entries, read: streamReader(bytes, header, fat, root) };
}
