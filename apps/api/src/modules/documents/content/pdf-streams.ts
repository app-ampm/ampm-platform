import { constants, inflateSync } from "node:zlib";

import type { PdfDecryptor } from "./pdf-crypt.js";
import { dictOf, entry, nameOf, numberOf, type PdfDict, type PdfValue } from "./pdf-objects.js";
import { refuse } from "./refusal.js";

/*
 * Where a PDF stream's data ends, and how an object stream is decoded (D-187 §2). A stream ends where its
 * /Length says when `endstream` follows there; otherwise at the next `endstream`, and a stream with none is
 * refused. Object streams are decrypted, then inflated (Flate only, with output caps); any other filter is
 * refused, because the objects inside could not be checked.
 */

const ENDSTREAM = Buffer.from("endstream", "latin1");
export const MAX_OBJECT_STREAM_BYTES = 8 * 1024 * 1024;
export const MAX_OBJECT_STREAMS_BYTES = 64 * 1024 * 1024;

const isEol = (byte: number | undefined): boolean => byte === 0x0a || byte === 0x0d;
const isSpace = (byte: number | undefined): boolean =>
  isEol(byte) || byte === 0x20 || byte === 0x09 || byte === 0x0c || byte === 0x00;

/** Integer objects (`12 0 obj 3456 endobj`) by number: the /Length values written after their stream. */
export function indexIntegerObjects(bytes: Buffer): Map<number, number> {
  const found = new Map<number, number>();
  const text = bytes.toString("latin1");
  const pattern =
    /(\d{1,10})[ \t\r\n\f\0]{1,8}\d{1,5}[ \t\r\n\f\0]{1,8}obj[ \t\r\n\f\0]{0,8}(\d{1,12})[ \t\r\n\f\0]{0,8}endobj/g;
  for (const match of text.matchAll(pattern)) {
    found.set(Number(match[1]), Number(match[2]));
  }
  return found;
}

/** The data's first byte: after `stream` and its end of line (CRLF, LF, or a lone CR some writers use). */
export function streamDataStart(bytes: Buffer, afterKeyword: number): number {
  let at = afterKeyword;
  if (bytes[at] === 0x0d) at += 1;
  if (bytes[at] === 0x0a) at += 1;
  return at;
}

function endstreamAt(bytes: Buffer, at: number): number | null {
  let cursor = at;
  while (cursor < bytes.length && cursor < at + 4 && isSpace(bytes[cursor])) cursor += 1;
  return bytes.subarray(cursor, cursor + ENDSTREAM.length).equals(ENDSTREAM) ? cursor : null;
}

function declaredLength(
  value: PdfValue | undefined,
  integers: ReadonlyMap<number, number>,
): number | null {
  if (value?.kind === "number") return value.value;
  if (value?.kind === "ref") return integers.get(value.num) ?? null;
  return null;
}

/** The data range of a stream and where reading resumes after its `endstream`. */
export function streamExtent(
  bytes: Buffer,
  dict: PdfDict,
  start: number,
  integers: ReadonlyMap<number, number>,
): { end: number; resume: number } {
  const length = declaredLength(entry(dict, "Length"), integers);
  if (
    length !== null &&
    Number.isInteger(length) &&
    length >= 0 &&
    start + length <= bytes.length
  ) {
    const at = endstreamAt(bytes, start + length);
    if (at !== null) return { end: start + length, resume: at + ENDSTREAM.length };
  }
  const found = bytes.indexOf(ENDSTREAM, start);
  if (found < 0) refuse("pdf_unreadable", "a stream without endstream");
  let end = found;
  while (end > start && isEol(bytes[end - 1])) end -= 1;
  return { end, resume: found + ENDSTREAM.length };
}

/** True for an object stream: /Type /ObjStm, or the /N and /First a reader needs to parse one. */
export function isObjectStream(dict: PdfDict): boolean {
  return (
    nameOf(entry(dict, "Type")) === "ObjStm" || (dict.entries.has("N") && dict.entries.has("First"))
  );
}

function filters(dict: PdfDict): string[] {
  const value = entry(dict, "Filter");
  if (value === undefined || value.kind === "null") return [];
  const items = value.kind === "array" ? value.items : [value];
  return items.map((item) => nameOf(item) ?? "?");
}

function hasPredictor(dict: PdfDict): boolean {
  const parameters = entry(dict, "DecodeParms");
  const first = parameters?.kind === "array" ? parameters.items[0] : parameters;
  const decodeDict = dictOf(first);
  return decodeDict !== null && (numberOf(entry(decodeDict, "Predictor")) ?? 1) > 1;
}

/** Shares the object streams' output cap across one file. */
export class ObjectStreamBudget {
  private spent = 0;

  spend(bytes: number): void {
    this.spent += bytes;
    if (this.spent > MAX_OBJECT_STREAMS_BYTES)
      refuse("pdf_unreadable", "object streams over 64 MiB");
  }
}

/**
 * Inflates Flate data. A stream cut short gives what it holds, as it does to a PDF reader (both see the
 * same objects); a bad header, bad data or more than 8 MiB is refused.
 */
function inflate(data: Buffer): Buffer {
  const options = { maxOutputLength: MAX_OBJECT_STREAM_BYTES, finishFlush: constants.Z_SYNC_FLUSH };
  try {
    return inflateSync(data, options);
  } catch {
    return refuse("pdf_unreadable", "an object stream that does not inflate within 8 MiB");
  }
}

/** An object stream's decoded content, decrypted first when the file is encrypted. */
export function decodeObjectStream(
  dict: PdfDict,
  data: Buffer,
  object: { num: number; gen: number },
  decryptor: PdfDecryptor | null,
  budget: ObjectStreamBudget,
): Buffer {
  const plain = decryptor ? decryptor.decryptStream(object.num, object.gen, data) : data;
  const names = filters(dict);
  if (names.length === 0) {
    budget.spend(plain.length);
    return plain;
  }
  const isFlate = names.length === 1 && (names[0] === "FlateDecode" || names[0] === "Fl");
  if (!isFlate || hasPredictor(dict)) {
    refuse("pdf_unreadable", `an object stream with filters ${names.join(", ")}`);
  }
  const decoded = inflate(plain);
  budget.spend(decoded.length);
  return decoded;
}
