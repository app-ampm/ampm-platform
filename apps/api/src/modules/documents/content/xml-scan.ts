import { fromFile, refuse } from "./refusal.js";

/*
 * A streaming XML tokenizer for the parts of an Office package (D-187 §2). It is fed the inflated chunks
 * as they come, keeps only the markup it is inside (capped at 1 MiB), and reports start tags, end tags
 * and, while asked to, the text between them. It refuses what Office's own parser refuses or what could
 * hide content from a byte-level check: a DTD (entity declarations), and an encoding other than UTF-8.
 */

export interface XmlEvents {
  /** A start or empty-element tag as written, from `<` to `>`, entities still encoded. */
  startTag(raw: string): void;
  /** An end tag's qualified name. */
  endTag(name: string): void;
  /** Character data, text or CDATA, while `capture` is on. Text keeps its entities encoded. */
  text(bytes: Buffer): void;
  /** The part ended, outside any markup (the scanner has checked that). */
  end?(): void;
}

export const MAX_MARKUP_BYTES = 1024 * 1024;
const MAX_DECLARATION_BYTES = 4096;
const LT = 0x3c;
const GT = 0x3e;
const BANG = 0x21;
const QUESTION = 0x3f;
const DASH = 0x2d;
const BRACKET = 0x5d;
const CDATA_OPEN = Buffer.from("![CDATA[", "latin1");
const COMMENT_OPEN = Buffer.from("!--", "latin1");

type Mode = "text" | "open" | "tag" | "comment" | "cdata" | "pi";

export class XmlScanner {
  /** While true, text and CDATA between tags go to `events.text`. */
  capture = false;
  private mode: Mode = "text";
  private head: Buffer | null = Buffer.alloc(0);
  private opening: number[] = [];
  private pieces: Buffer[] = [];
  private pieceBytes = 0;
  private quote = 0;
  private run = 0;
  private sawMarkup = false;

  constructor(
    private readonly events: XmlEvents,
    private readonly part: string,
  ) {}

  write(chunk: Buffer): void {
    if (this.head === null) {
      this.consume(chunk, 0);
      return;
    }
    const head = Buffer.concat([this.head, chunk]);
    if (head.length < 4) {
      this.head = head;
      return;
    }
    this.head = null;
    this.consume(head, this.startOffset(head));
  }

  end(): void {
    if (this.head !== null) {
      const head = this.head;
      this.head = null;
      this.consume(head, this.startOffset(head));
    }
    if (this.mode !== "text")
      refuse("file_damaged", `XML that ends inside markup in ${fromFile(this.part)}`);
    this.events.end?.();
  }

  /** Skips a UTF-8 byte order mark; refuses UTF-16 and UTF-32, with or without one. */
  private startOffset(head: Buffer): number {
    if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) return 3;
    const wide =
      (head[0] === 0xfe && head[1] === 0xff) ||
      (head[0] === 0xff && head[1] === 0xfe) ||
      head[0] === 0 ||
      head[1] === 0;
    if (wide && head.length > 1)
      refuse("file_damaged", `XML not in UTF-8 in ${fromFile(this.part)}`);
    return 0;
  }

  private consume(chunk: Buffer, from: number): void {
    let at = from;
    while (at < chunk.length) at = this.step(chunk, at);
  }

  private step(chunk: Buffer, at: number): number {
    switch (this.mode) {
      case "text":
        return this.inText(chunk, at);
      case "open":
        return this.inOpen(chunk, at);
      case "tag":
        return this.inTag(chunk, at);
      case "comment":
        return this.inComment(chunk, at);
      case "cdata":
        return this.inCdata(chunk, at);
      case "pi":
        return this.inPi(chunk, at);
    }
  }

  private inText(chunk: Buffer, at: number): number {
    const lt = chunk.indexOf(LT, at);
    const stop = lt === -1 ? chunk.length : lt;
    if (this.capture && stop > at) this.events.text(chunk.subarray(at, stop));
    if (lt === -1) return chunk.length;
    this.mode = "open";
    this.opening = [];
    return lt + 1;
  }

  /** Reads up to the 8 bytes after `<` that tell a tag from a comment, CDATA, a PI or a declaration. */
  private inOpen(chunk: Buffer, at: number): number {
    const byte = chunk[at] ?? 0;
    this.opening.push(byte);
    const [first] = this.opening;
    if (first === QUESTION) return this.enter("pi", "<?", at + 1);
    if (first !== BANG) return this.enter("tag", "<", at);
    const opened = Buffer.from(this.opening);
    if (opened.equals(COMMENT_OPEN)) return this.enter("comment", "", at + 1);
    if (opened.equals(CDATA_OPEN)) return this.enter("cdata", "", at + 1);
    const prefix = (open: Buffer): boolean => open.subarray(0, opened.length).equals(opened);
    if (!prefix(COMMENT_OPEN) && !prefix(CDATA_OPEN)) {
      refuse("file_damaged", `a DTD or declaration in ${fromFile(this.part)}`);
    }
    return at + 1;
  }

  private enter(mode: Mode, markup: string, at: number): number {
    this.mode = mode;
    this.pieces = markup === "" ? [] : [Buffer.from(markup, "latin1")];
    this.pieceBytes = markup.length;
    this.quote = 0;
    this.run = 0;
    return at;
  }

  private keep(piece: Buffer, limit: number): void {
    this.pieceBytes += piece.length;
    if (this.pieceBytes > limit)
      refuse("file_damaged", `XML markup over ${limit} bytes in ${fromFile(this.part)}`);
    this.pieces.push(piece);
  }

  private markup(): string {
    const text = Buffer.concat(this.pieces, this.pieceBytes).toString("utf8");
    this.pieces = [];
    this.pieceBytes = 0;
    this.sawMarkup = true;
    this.mode = "text";
    return text;
  }

  /** A tag ends at the first `>` outside quotes. */
  private inTag(chunk: Buffer, at: number): number {
    let index = at;
    for (; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (this.quote !== 0) {
        if (byte === this.quote) this.quote = 0;
      } else if (byte === 0x22 || byte === 0x27) {
        this.quote = byte;
      } else if (byte === GT) {
        break;
      }
    }
    const closed = index < chunk.length;
    this.keep(chunk.subarray(at, closed ? index + 1 : index), MAX_MARKUP_BYTES);
    if (!closed) return index;
    const raw = this.markup();
    if (raw.startsWith("</")) this.events.endTag(raw.slice(2, -1).trim());
    else this.events.startTag(raw);
    return index + 1;
  }

  private inComment(chunk: Buffer, at: number): number {
    for (let index = at; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (byte === GT && this.run >= 2) return this.closeQuietly(index + 1);
      this.run = byte === DASH ? this.run + 1 : 0;
    }
    return chunk.length;
  }

  /** CDATA ends at `]]>`; while capturing, its content is kept (capped) and reported without the `]]`. */
  private inCdata(chunk: Buffer, at: number): number {
    for (let index = at; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (byte === GT && this.run >= 2) {
        if (this.capture) {
          this.keep(chunk.subarray(at, index), MAX_MARKUP_BYTES);
          const content = Buffer.concat(this.pieces, this.pieceBytes);
          this.events.text(content.subarray(0, content.length - 2));
        }
        this.pieces = [];
        this.pieceBytes = 0;
        return this.closeQuietly(index + 1);
      }
      this.run = byte === BRACKET ? this.run + 1 : 0;
    }
    if (this.capture) this.keep(chunk.subarray(at), MAX_MARKUP_BYTES);
    return chunk.length;
  }

  /** A processing instruction; the first one may be the XML declaration, whose encoding is checked. */
  private inPi(chunk: Buffer, at: number): number {
    for (let index = at; index < chunk.length; index += 1) {
      if (chunk[index] === GT && this.run === 1) {
        this.keep(chunk.subarray(at, index + 1), Number.MAX_SAFE_INTEGER);
        this.checkDeclaration();
        return index + 1;
      }
      this.run = chunk[index] === QUESTION ? 1 : 0;
    }
    if (this.pieceBytes < MAX_DECLARATION_BYTES)
      this.keep(chunk.subarray(at), Number.MAX_SAFE_INTEGER);
    return chunk.length;
  }

  private checkDeclaration(): void {
    const isFirst = !this.sawMarkup;
    const declaration = this.markup().slice(0, MAX_DECLARATION_BYTES);
    if (!isFirst || !/^<\?xml\s/.test(declaration)) return;
    const encoding = /\bencoding\s*=\s*["']([^"']*)["']/.exec(declaration)?.[1];
    if (encoding !== undefined && !/^utf-?8$/i.test(encoding)) {
      refuse("file_damaged", `XML declared as ${fromFile(encoding)} in ${fromFile(this.part)}`);
    }
  }

  private closeQuietly(at: number): number {
    this.sawMarkup = true;
    this.mode = "text";
    this.run = 0;
    return at;
  }
}

const ENTITY = /&(?:#x([0-9a-fA-F]{1,8})|#([0-9]{1,10})|(lt|gt|amp|quot|apos));/g;
const NAMED: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

function fromCodePoint(code: number): string {
  const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
  return valid ? String.fromCodePoint(code) : "�";
}

/** Replaces character and predefined entity references the way an XML parser does. */
export function decodeXmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(ENTITY, (_whole, hex?: string, decimal?: string, named?: string) => {
    if (hex !== undefined) return fromCodePoint(Number.parseInt(hex, 16));
    if (decimal !== undefined) return fromCodePoint(Number.parseInt(decimal, 10));
    return NAMED[named ?? ""] ?? "";
  });
}
