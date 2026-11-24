/*
 * A small compound file writer for the content checks' specs ([MS-CFB] version 3, 512-byte sectors):
 * storages and streams, small streams in the mini stream, the rest in regular sectors. The directory is
 * a chain of right siblings rather than a balanced red-black tree, which readers accept. `tamper` gets
 * the layout so a spec can break one field. Test-only: the build leaves `testing/` folders out.
 */

export interface CfbNode {
  readonly name: string;
  /** A stream's bytes; a node without data is a storage. */
  readonly data?: Buffer;
  readonly children?: readonly CfbNode[];
}

export interface CfbLayout {
  /** Byte offset of a directory entry (0 is the root). */
  entryOffset(id: number): number;
  /** The entry id of the first node with `name`. */
  idOf(name: string): number;
  /** Byte offset of FAT entry `sector`. */
  fatEntryOffset(sector: number): number;
  /** The first regular sector of a stream, or of the directory with "directory". */
  firstSector(name: string): number;
}

const SECTOR = 512;
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;
const FAT_SECTOR = 0xfffffffd;
const NO_ENTRY = 0xffffffff;
const CUTOFF = 4096;
/** A directory entry's links and extent before the layout fills them in. */
const UNLINKED = { child: 0xffffffff, right: 0xffffffff, start: 0, size: 0 } as const;

interface Flat {
  readonly node: CfbNode | null;
  readonly name: string;
  child: number;
  right: number;
  start: number;
  size: number;
}

function flatten(nodes: readonly CfbNode[], flat: Flat[]): number {
  let first = NO_ENTRY;
  let previous: Flat | null = null;
  for (const node of nodes) {
    const id = flat.length;
    const entry: Flat = {
      node,
      name: node.name,
      child: NO_ENTRY,
      right: NO_ENTRY,
      start: 0,
      size: 0,
    };
    flat.push(entry);
    if (node.data === undefined) entry.child = flatten(node.children ?? [], flat);
    if (previous) previous.right = id;
    else first = id;
    previous = entry;
  }
  return first;
}

const sectorsFor = (bytes: number): number => Math.ceil(bytes / SECTOR);

function directoryEntry(entry: Flat): Buffer {
  const out = Buffer.alloc(128);
  const name = Buffer.from(`${entry.name}\0`, "utf16le");
  name.copy(out, 0);
  out.writeUInt16LE(name.length, 64);
  out.writeUInt8(entry.node === null ? 5 : entry.node.data === undefined ? 1 : 2, 66);
  out.writeUInt8(1, 67);
  out.writeUInt32LE(NO_ENTRY, 68);
  out.writeUInt32LE(entry.right, 72);
  out.writeUInt32LE(entry.child, 76);
  out.writeUInt32LE(entry.start, 116);
  out.writeUInt32LE(entry.size, 120);
  return out;
}

function header(
  fatSectors: number[],
  directoryStart: number,
  miniFatStart: number,
  miniFatCount: number,
): Buffer {
  const out = Buffer.alloc(SECTOR, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(out, 0);
  out.writeUInt16LE(0x003e, 24);
  out.writeUInt16LE(3, 26);
  out.writeUInt16LE(0xfffe, 28);
  out.writeUInt16LE(9, 30);
  out.writeUInt16LE(6, 32);
  out.writeUInt32LE(fatSectors.length, 44);
  out.writeUInt32LE(directoryStart, 48);
  out.writeUInt32LE(CUTOFF, 56);
  out.writeUInt32LE(miniFatCount === 0 ? END_OF_CHAIN : miniFatStart, 60);
  out.writeUInt32LE(miniFatCount, 64);
  out.writeUInt32LE(END_OF_CHAIN, 68);
  for (let index = 0; index < 109; index += 1) {
    out.writeUInt32LE(fatSectors[index] ?? FREE, 76 + index * 4);
  }
  return out;
}

const padTo = (data: Buffer, size: number): Buffer =>
  Buffer.concat([data, Buffer.alloc(size - data.length)]);

interface Region {
  readonly name: string;
  data: Buffer;
}

/** Puts the small streams in the mini stream; returns the mini stream and its mini FAT. */
function layoutMini(small: readonly Flat[]): { stream: Buffer; table: number[] } {
  const chunks: Buffer[] = [];
  const table: number[] = [];
  for (const entry of small) {
    const data = entry.node?.data ?? Buffer.alloc(0);
    const count = Math.ceil(data.length / 64);
    entry.start = count === 0 ? END_OF_CHAIN : table.length;
    entry.size = data.length;
    for (let index = 0; index < count; index += 1) {
      table.push(index === count - 1 ? END_OF_CHAIN : table.length + 1);
    }
    chunks.push(padTo(data, count * 64));
  }
  return { stream: Buffer.concat(chunks), table };
}

/** Chains every region's sectors after the FAT's own; returns the FAT and where each region starts. */
function layoutFat(regions: readonly Region[]): {
  fat: number[];
  fatCount: number;
  starts: Map<string, number>;
} {
  const dataSectors = regions.reduce((sum, region) => sum + sectorsFor(region.data.length), 0);
  let fatCount = 1;
  while (fatCount * 128 < fatCount + dataSectors) fatCount += 1;
  const fat = new Array<number>(fatCount * 128).fill(FREE);
  for (let sector = 0; sector < fatCount; sector += 1) fat[sector] = FAT_SECTOR;
  const starts = new Map<string, number>();
  let next = fatCount;
  for (const region of regions) {
    const count = sectorsFor(region.data.length);
    starts.set(region.name, count === 0 ? END_OF_CHAIN : next);
    for (let index = 0; index < count; index += 1) {
      fat[next + index] = index === count - 1 ? END_OF_CHAIN : next + index + 1;
    }
    next += count;
  }
  return { fat, fatCount, starts };
}

/** Points the root at the mini stream and each large stream at its first sector. */
function placeStreams(
  root: Flat,
  miniStreamBytes: number,
  large: readonly Flat[],
  starts: ReadonlyMap<string, number>,
): void {
  root.start = miniStreamBytes === 0 ? END_OF_CHAIN : (starts.get("ministream") ?? END_OF_CHAIN);
  root.size = miniStreamBytes;
  for (const entry of large) {
    entry.start = starts.get(entry.name) ?? END_OF_CHAIN;
    entry.size = entry.node?.data?.length ?? 0;
  }
}

/** The header, the FAT sectors (first after the header), then every region in its sectors. */
function assemble(
  regions: readonly Region[],
  fat: readonly number[],
  fatCount: number,
  starts: ReadonlyMap<string, number>,
  miniFatSectors: number,
): Buffer {
  const fatBytes = Buffer.alloc(fatCount * SECTOR);
  fat.forEach((value, index) => fatBytes.writeUInt32LE(value >>> 0, index * 4));
  const body = regions.map((region) => padTo(region.data, sectorsFor(region.data.length) * SECTOR));
  const fatSectors = Array.from({ length: fatCount }, (_, index) => index);
  const directory = starts.get("directory") ?? 0;
  const head = header(fatSectors, directory, starts.get("minifat") ?? 0, miniFatSectors);
  return Buffer.concat([head, fatBytes, ...body]);
}

/**
 * A compound file holding `nodes` under its root.
 *
 * @example
 * const xls = writeCompoundFile([{ name: "Workbook", data: workbookStream() }]);
 */
export function writeCompoundFile(
  nodes: readonly CfbNode[],
  tamper?: (bytes: Buffer, layout: CfbLayout) => void,
): Buffer {
  const root: Flat = { node: null, name: "Root Entry", ...UNLINKED };
  const flat: Flat[] = [root];
  root.child = flatten(nodes, flat);
  const streams = flat.filter((entry) => entry.node?.data !== undefined);
  const large = streams.filter((entry) => (entry.node?.data?.length ?? 0) >= CUTOFF);
  const mini = layoutMini(streams.filter((entry) => (entry.node?.data?.length ?? 0) < CUTOFF));
  const directoryBytes = sectorsFor(flat.length * 128) * SECTOR;
  const miniFatBytes = Buffer.alloc(sectorsFor(mini.table.length * 4) * SECTOR, 0xff);
  mini.table.forEach((value, index) => miniFatBytes.writeUInt32LE(value, index * 4));
  const regions: Region[] = [
    { name: "directory", data: Buffer.alloc(directoryBytes) },
    { name: "minifat", data: miniFatBytes },
    { name: "ministream", data: padTo(mini.stream, sectorsFor(mini.stream.length) * SECTOR) },
    ...large.map((entry) => ({ name: entry.name, data: entry.node?.data ?? Buffer.alloc(0) })),
  ];
  const { fat, fatCount, starts } = layoutFat(regions);
  placeStreams(root, mini.stream.length, large, starts);
  regions[0] = {
    name: "directory",
    data: padTo(Buffer.concat(flat.map(directoryEntry)), directoryBytes),
  };
  const bytes = assemble(regions, fat, fatCount, starts, sectorsFor(mini.table.length * 4));
  tamper?.(bytes, {
    entryOffset: (id) => ((starts.get("directory") ?? 0) + 1) * SECTOR + id * 128,
    idOf: (name) => flat.findIndex((entry) => entry.name === name),
    fatEntryOffset: (sector) => (1 + Math.floor(sector / 128)) * SECTOR + (sector % 128) * 4,
    firstSector: (name) => starts.get(name) ?? END_OF_CHAIN,
  });
  return bytes;
}
