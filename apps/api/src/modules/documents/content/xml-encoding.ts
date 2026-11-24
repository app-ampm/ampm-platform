import { fromFile, refuse } from "./refusal.js";

/*
 * The encoding of an Office package's XML part (D-187 §2). ECMA-376 Part 2 allows UTF-8 and UTF-16, and the
 * tokenizer reads UTF-8: a UTF-8 byte order mark is skipped, and a part in UTF-16 with its byte order mark
 * is transcoded as it streams, one chunk at a time (a character split across chunks is carried over), so
 * the work and the memory stay bounded by the chunk. UTF-16 without a byte order mark, UTF-32 and invalid
 * UTF-16 are refused, and so is a declaration naming another encoding than the one the bytes are in.
 */

const EMPTY = Buffer.alloc(0);
const UTF8_MARK = [0xef, 0xbb, 0xbf];
const UTF8_LABEL = /^utf-?8$/i;
const UTF16_LABEL = /^utf-?16$/i;

export class XmlEncoding {
  private head: Buffer | null = EMPTY;
  private decoder: TextDecoder | null = null;

  constructor(private readonly part: string) {}

  /** The UTF-8 bytes of the next chunk; none while the first four bytes are still being gathered. */
  write(chunk: Buffer): Buffer {
    if (this.head === null) return this.transcode(chunk, true);
    const head = Buffer.concat([this.head, chunk]);
    if (head.length < 4) {
      this.head = head;
      return EMPTY;
    }
    this.head = null;
    return this.transcode(head.subarray(this.start(head)), true);
  }

  /** The UTF-8 bytes still held at the end of the part; refuses UTF-16 that ends inside a character. */
  end(): Buffer {
    const head = this.head;
    this.head = null;
    const rest = head === null ? EMPTY : this.transcode(head.subarray(this.start(head)), true);
    return Buffer.concat([rest, this.transcode(EMPTY, false)]);
  }

  /** Refuses an encoding declared in the XML declaration that is not the one the bytes are in. */
  checkDeclared(encoding: string): void {
    if (!(this.decoder === null ? UTF8_LABEL : UTF16_LABEL).test(encoding)) {
      refuse("file_damaged", `XML declared as ${fromFile(encoding)} in ${fromFile(this.part)}`);
    }
  }

  /** Where the text starts: after a byte order mark, which also says the encoding. */
  private start(head: Buffer): number {
    if (UTF8_MARK.every((byte, index) => head[index] === byte)) return 3;
    const utf32 = head[0] === 0xff && head[1] === 0xfe && head[2] === 0 && head[3] === 0;
    if (!utf32 && head[0] === 0xff && head[1] === 0xfe) return this.utf16("utf-16le");
    if (head[0] === 0xfe && head[1] === 0xff) return this.utf16("utf-16be");
    if (head.length > 1 && (utf32 || head[0] === 0 || head[1] === 0)) {
      refuse("file_damaged", `XML in neither UTF-8 nor marked UTF-16 in ${fromFile(this.part)}`);
    }
    return 0;
  }

  /** Transcodes from here on; the mark itself (two bytes) is skipped, and no later one is dropped. */
  private utf16(label: "utf-16le" | "utf-16be"): number {
    this.decoder = new TextDecoder(label, { fatal: true, ignoreBOM: true });
    return 2;
  }

  private transcode(bytes: Buffer, stream: boolean): Buffer {
    if (this.decoder === null) return bytes;
    try {
      return Buffer.from(this.decoder.decode(bytes, { stream }), "utf8");
    } catch {
      return refuse("file_damaged", `XML that is not valid UTF-16 in ${fromFile(this.part)}`);
    }
  }
}
