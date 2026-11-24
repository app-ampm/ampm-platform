import { refuse } from "./refusal.js";

/*
 * A PDF tokenizer (ISO 32000-2 §7.2 and §7.3): names with their `#xx` escapes decoded, numbers, literal
 * and hexadecimal strings, delimiters and keywords, with comments skipped. Strings are walked to their
 * end whatever their length, but only their first 1 KiB is kept: the checks read short strings only
 * (the encryption dictionary's keys and the file identifier).
 */

export type PdfToken =
  | { readonly kind: "name"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: Buffer }
  | { readonly kind: "keyword"; readonly value: string }
  | { readonly kind: "open"; readonly value: "<<" | "[" }
  | { readonly kind: "close"; readonly value: ">>" | "]" };

const KEPT_STRING_BYTES = 1024;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

const isWhitespace = (byte: number): boolean =>
  byte === 0x20 ||
  byte === 0x0a ||
  byte === 0x0d ||
  byte === 0x09 ||
  byte === 0x0c ||
  byte === 0x00;
const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
const isRegular = (byte: number): boolean => !isWhitespace(byte) && !DELIMITERS.has(byte);
const hexValue = (byte: number): number => {
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30;
  if (byte >= 0x41 && byte <= 0x46) return byte - 0x37;
  if (byte >= 0x61 && byte <= 0x66) return byte - 0x57;
  return -1;
};

const ESCAPES: Readonly<Record<number, number>> = {
  0x6e: 0x0a,
  0x72: 0x0d,
  0x74: 0x09,
  0x62: 0x08,
  0x66: 0x0c,
};

export class PdfLexer {
  position: number;

  constructor(
    private readonly bytes: Buffer,
    start = 0,
    private readonly end = bytes.length,
  ) {
    this.position = start;
  }

  /** The next token, or null at the end. */
  next(): PdfToken | null {
    this.skipSpace();
    if (this.position >= this.end) return null;
    const byte = this.bytes[this.position] ?? 0;
    const following = this.bytes[this.position + 1];
    if (byte === 0x2f) return { kind: "name", value: this.name() };
    if (byte === 0x28) return { kind: "string", value: this.literal() };
    if (byte === 0x3c && following === 0x3c) return this.symbol("open", "<<");
    if (byte === 0x3e && following === 0x3e) return this.symbol("close", ">>");
    if (byte === 0x3c) return { kind: "string", value: this.hex() };
    if (byte === 0x5b) return this.symbol("open", "[");
    if (byte === 0x5d) return this.symbol("close", "]");
    if (!isRegular(byte)) {
      this.position += 1;
      return { kind: "keyword", value: String.fromCharCode(byte) };
    }
    const word = this.run();
    return NUMBER.test(word)
      ? { kind: "number", value: Number(word) }
      : { kind: "keyword", value: word };
  }

  private symbol<K extends "open" | "close", V extends string>(kind: K, value: V) {
    this.position += value.length;
    return { kind, value } as const;
  }

  private skipSpace(): void {
    while (this.position < this.end) {
      const byte = this.bytes[this.position] ?? 0;
      if (byte === 0x25) {
        while (
          this.position < this.end &&
          this.bytes[this.position] !== 0x0a &&
          this.bytes[this.position] !== 0x0d
        ) {
          this.position += 1;
        }
      } else if (isWhitespace(byte)) {
        this.position += 1;
      } else {
        return;
      }
    }
  }

  private run(): string {
    const start = this.position;
    while (this.position < this.end && isRegular(this.bytes[this.position] ?? 0))
      this.position += 1;
    return this.bytes.toString("latin1", start, this.position);
  }

  /** A name, `#xx` escapes decoded (`/J#61vaScript` is `/JavaScript`). */
  private name(): string {
    this.position += 1;
    const raw = this.run();
    return raw.replace(/#([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  }

  private literal(): Buffer {
    const kept: number[] = [];
    const keep = (byte: number): void => {
      if (kept.length < KEPT_STRING_BYTES) kept.push(byte);
    };
    let depth = 1;
    this.position += 1;
    while (this.position < this.end) {
      const byte = this.bytes[this.position] ?? 0;
      this.position += 1;
      if (byte === 0x5c) {
        this.escape(keep);
        continue;
      }
      if (byte === 0x28) depth += 1;
      if (byte === 0x29) depth -= 1;
      if (depth === 0) return Buffer.from(kept);
      keep(byte);
    }
    return refuse("pdf_unreadable", "a string that never ends");
  }

  private escape(keep: (byte: number) => void): void {
    const byte = this.bytes[this.position] ?? 0;
    this.position += 1;
    if (byte >= 0x30 && byte <= 0x37) {
      let value = byte - 0x30;
      for (let digits = 1; digits < 3; digits += 1) {
        const next = this.bytes[this.position] ?? 0;
        if (next < 0x30 || next > 0x37) break;
        value = value * 8 + (next - 0x30);
        this.position += 1;
      }
      keep(value & 0xff);
    } else if (byte === 0x0d) {
      if (this.bytes[this.position] === 0x0a) this.position += 1;
    } else if (byte !== 0x0a) {
      keep(ESCAPES[byte] ?? byte);
    }
  }

  private hex(): Buffer {
    const digits: number[] = [];
    this.position += 1;
    while (this.position < this.end) {
      const byte = this.bytes[this.position] ?? 0;
      this.position += 1;
      if (byte === 0x3e) {
        if (digits.length % 2 === 1) digits.push(0);
        const out = Buffer.alloc(digits.length / 2);
        for (let index = 0; index < out.length; index += 1) {
          out[index] = ((digits[index * 2] ?? 0) << 4) | (digits[index * 2 + 1] ?? 0);
        }
        return out;
      }
      const value = hexValue(byte);
      if (value >= 0 && digits.length < KEPT_STRING_BYTES * 2) digits.push(value);
    }
    return refuse("pdf_unreadable", "a hexadecimal string that never ends");
  }
}
