import { firstFileId, openEncryption, type PdfDecryptor } from "./pdf-crypt.js";
import { refuseUnexaminedHeaders } from "./pdf-headers.js";
import { PdfLexer, type PdfToken } from "./pdf-lexer.js";
import {
  dictOf,
  entry,
  nameOf,
  objectId,
  PdfBuilder,
  type PdfDict,
  type PdfValue,
} from "./pdf-objects.js";
import {
  decodeObjectStream,
  indexIntegerObjects,
  isObjectStream,
  ObjectStreamBudget,
  streamDataStart,
  streamExtent,
} from "./pdf-streams.js";
import { refuse } from "./refusal.js";

/*
 * The PDF check (D-187 §2). Every object outside streams, and every object inside the object streams
 * (decrypted when the file is encrypted, then inflated), is scanned for the names that run code or carry
 * other files: /JavaScript, /JS, /Launch, /EmbeddedFile, /EmbeddedFiles, /RichMedia, /XFA and /GoToE,
 * after `#xx` escapes are decoded. /EF is refused with them: an embedded file stream's /Type is optional,
 * and /EF is the file specification key that every embedded file is reached by (a file attachment
 * annotation needs no /EmbeddedFiles tree). A stream without `endstream`, or an object stream it cannot
 * decode, is unreadable, and so is an object header a viewer could read where this reading does not pass
 * (in a comment, a string or stream data: pdf-headers.ts). An encrypted file is opened with the empty user
 * password; one that needs a password to open is refused.
 */

export const REFUSED_NAMES: ReadonlySet<string> = new Set([
  "JavaScript",
  "JS",
  "Launch",
  "EmbeddedFile",
  "EmbeddedFiles",
  "EF",
  "RichMedia",
  "XFA",
  "GoToE",
]);
const MAX_OBJECTS = 1_000_000;

interface ObjectStream {
  readonly dict: PdfDict;
  readonly data: Buffer;
  readonly object: { num: number; gen: number };
}

function refuseName(token: PdfToken): void {
  if (token.kind === "name" && REFUSED_NAMES.has(token.value)) {
    refuse("pdf_active_content", `the name /${token.value}`);
  }
}

/** Scans decoded object stream content: every name, no streams inside. */
function scanNames(content: Buffer): void {
  const lexer = new PdfLexer(content);
  for (let token = lexer.next(); token; token = lexer.next()) refuseName(token);
}

class PdfScan {
  readonly lexer: PdfLexer;
  readonly builder = new PdfBuilder();
  readonly objects = new Map<number, number>();
  readonly trailers: PdfDict[] = [];
  readonly objectStreams: ObjectStream[] = [];
  /** Where each `obj` keyword this reading passed through starts, in order. */
  readonly objKeywords: number[] = [];
  private current: { num: number; gen: number } | null = null;
  private trailerNext = false;

  constructor(
    private readonly bytes: Buffer,
    private readonly integers: ReadonlyMap<number, number>,
  ) {
    this.lexer = new PdfLexer(bytes);
  }

  run(): void {
    for (let token = this.lexer.next(); token; token = this.lexer.next()) {
      refuseName(token);
      if (token.kind === "keyword" && this.structural(token.value)) continue;
      const value = this.builder.push(token);
      if (this.trailerNext && value?.kind === "dict") {
        this.trailers.push(value);
        this.trailerNext = false;
      }
    }
  }

  /** Handles obj, endobj, stream and trailer; false for any other keyword. */
  private structural(keyword: string): boolean {
    if (keyword === "obj") this.openObject();
    else if (keyword === "endobj") this.closeObject();
    else if (keyword === "stream") this.stream();
    else if (keyword === "trailer") this.trailerNext = true;
    else return false;
    return true;
  }

  private openObject(): void {
    this.objKeywords.push(this.lexer.position - "obj".length);
    if (this.objKeywords.length > MAX_OBJECTS) refuse("pdf_unreadable", "over a million objects");
    const id = this.builder.depth === 0 ? objectId(this.builder.top) : null;
    this.builder.clear();
    this.current = id;
    if (id) this.objects.set(id.num, this.lexer.position);
  }

  private closeObject(): void {
    this.builder.clear();
    this.current = null;
  }

  private stream(): void {
    const dict =
      this.builder.depth === 0 ? dictOf(this.builder.top[this.builder.top.length - 1]) : null;
    if (!dict) refuse("pdf_unreadable", "a stream without a dictionary");
    const start = streamDataStart(this.bytes, this.lexer.position);
    const { end, resume } = streamExtent(this.bytes, dict, start, this.integers);
    this.lexer.position = resume;
    this.builder.clear();
    if (nameOf(entry(dict, "Type")) === "XRef") this.trailers.push(dict);
    if (isObjectStream(dict)) {
      if (!this.current) refuse("pdf_unreadable", "an object stream outside an object");
      this.objectStreams.push({
        dict,
        data: this.bytes.subarray(start, end),
        object: this.current,
      });
    }
  }
}

/** The value of an indirect object, read again from where its `obj` keyword ended. */
function readObject(bytes: Buffer, offset: number): PdfValue | null {
  const lexer = new PdfLexer(bytes, offset);
  const builder = new PdfBuilder();
  for (let token = lexer.next(); token; token = lexer.next()) {
    if (token.kind === "keyword" && ["endobj", "stream", "obj"].includes(token.value)) break;
    const value = builder.push(token);
    if (value && builder.depth === 0) return value;
  }
  return null;
}

/** The decryptor for an encrypted file (refusing one that needs a password), or null. */
function decryptorOf(bytes: Buffer, scan: PdfScan): PdfDecryptor | null {
  const trailer = [...scan.trailers].reverse().find((dict) => dict.entries.has("Encrypt"));
  if (!trailer) return null;
  const value = entry(trailer, "Encrypt");
  let encrypt = dictOf(value);
  if (value?.kind === "ref") {
    const offset = scan.objects.get(value.num);
    encrypt = offset === undefined ? null : dictOf(readObject(bytes, offset) ?? undefined);
  }
  if (!encrypt) refuse("pdf_unreadable", "an encryption dictionary it cannot find");
  return openEncryption(encrypt, firstFileId(entry(trailer, "ID")));
}

/**
 * Refuses a PDF with active content, an unreadable stream, or a password needed to open it.
 *
 * @example
 * checkPdf(bytes); // throws a ContentRefusal for a PDF with /JavaScript
 */
export function checkPdf(bytes: Buffer): void {
  const scan = new PdfScan(bytes, indexIntegerObjects(bytes));
  scan.run();
  refuseUnexaminedHeaders(bytes, scan.objKeywords);
  const decryptor = decryptorOf(bytes, scan);
  const budget = new ObjectStreamBudget();
  for (const stream of scan.objectStreams) {
    scanNames(decodeObjectStream(stream.dict, stream.data, stream.object, decryptor, budget));
  }
}
