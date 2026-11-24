import type { UploadRefusalReason } from "@ampm/core";
import { crc32, createInflateRaw } from "node:zlib";

import { ContentRefusal, refuse } from "./refusal.js";
import type { ZipEntry } from "./zip.js";

/*
 * Reading a ZIP entry's data (D-187 §2). Expansion is measured while inflating, never taken from the
 * declared sizes: an entry may produce at most 200 bytes for each stored byte, and a whole package at most
 * 256 MiB. Inflation streams through node:zlib in 64 KiB chunks and keeps nothing unless the caller keeps
 * it, so a zip bomb costs a bounded amount of work and almost no memory. The output must then match the
 * declared size and CRC-32.
 */

export const MAX_EXPANSION_RATIO = 200;
/**
 * Output any entry may reach whatever its ratio. Tiny parts are noisy (4 KiB of printer settings, mostly
 * zeros, deflate to a few bytes), and the package-wide cap bounds the work either way.
 */
export const RATIO_FREE_BYTES = 1024 * 1024;
export const MAX_PACKAGE_EXPANSION = 256 * 1024 * 1024;
/** The most a part read into memory (content types, relationships, an embedded package) may hold. */
export const MAX_KEPT_PART_BYTES = 2 * 1024 * 1024;
const CHUNK_BYTES = 64 * 1024;

/** The output a package's entries may still produce, shared by an embedded package and its host. */
export class ExpansionBudget {
  private spent = 0;

  constructor(private readonly limit = MAX_PACKAGE_EXPANSION) {}

  spend(bytes: number, name: string): void {
    this.spent += bytes;
    if (this.spent > this.limit) {
      refuse("archive_expansion", `the package expands past ${this.limit} bytes at ${name}`);
    }
  }
}

export type ChunkSink = (chunk: Buffer) => void;

async function inflateChunks(data: Buffer, take: ChunkSink): Promise<void> {
  const inflater = createInflateRaw({ chunkSize: CHUNK_BYTES });
  inflater.end(data);
  try {
    for await (const chunk of inflater) {
      if (!Buffer.isBuffer(chunk)) refuse("file_damaged", "inflate produced no bytes");
      take(chunk);
    }
  } catch (error) {
    if (error instanceof ContentRefusal) throw error;
    const message = error instanceof Error ? error.message : "unknown";
    refuse("file_damaged", `a deflate stream that does not inflate (${message})`);
  } finally {
    inflater.destroy();
  }
}

/**
 * Inflates one entry, counting its output against its own ratio and the package budget, and hands each
 * chunk to `sink`. Refuses an entry whose output size or CRC-32 differs from the central directory's.
 */
export async function inflateEntry(
  bytes: Buffer,
  entry: ZipEntry,
  budget: ExpansionBudget,
  sink?: ChunkSink,
): Promise<void> {
  const limit = Math.max(entry.compressedSize * MAX_EXPANSION_RATIO, RATIO_FREE_BYTES);
  let produced = 0;
  let crc = 0;
  const take = (chunk: Buffer): void => {
    produced += chunk.length;
    if (produced > limit) refuse("archive_expansion", `${entry.name} expands over 200:1`);
    budget.spend(chunk.length, entry.name);
    crc = crc32(chunk, crc);
    sink?.(chunk);
  };
  const data = bytes.subarray(entry.dataStart, entry.dataEnd);
  if (entry.method === 0) take(data);
  else await inflateChunks(data, take);
  if (produced !== entry.uncompressedSize) {
    refuse("file_damaged", `${entry.name} inflates to ${produced} bytes, not its declared size`);
  }
  if (crc >>> 0 !== entry.crc >>> 0) refuse("file_damaged", `a CRC mismatch in ${entry.name}`);
}

/**
 * Inflates one entry into memory, refusing with `overCap` when it holds more than 2 MiB. Only the parts
 * the checks parse are read this way.
 */
export async function readEntry(
  bytes: Buffer,
  entry: ZipEntry,
  budget: ExpansionBudget,
  overCap: UploadRefusalReason,
): Promise<Buffer> {
  const refuseOver = (): never =>
    refuse(overCap, `${entry.name} holds over ${MAX_KEPT_PART_BYTES} bytes`);
  if (entry.uncompressedSize > MAX_KEPT_PART_BYTES) refuseOver();
  const chunks: Buffer[] = [];
  let size = 0;
  await inflateEntry(bytes, entry, budget, (chunk) => {
    size += chunk.length;
    if (size > MAX_KEPT_PART_BYTES) refuseOver();
    chunks.push(chunk);
  });
  return Buffer.concat(chunks, size);
}
