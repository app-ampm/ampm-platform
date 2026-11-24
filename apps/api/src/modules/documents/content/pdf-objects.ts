import type { PdfToken } from "./pdf-lexer.js";
import { refuse } from "./refusal.js";

/*
 * PDF objects built from tokens (ISO 32000-2 §7.3): the dictionaries and arrays the checks read (stream
 * dictionaries, trailers, the encryption dictionary). Nesting is capped at 256 levels and one top-level
 * object at a million values, so a hostile file cannot make the builder grow without bound.
 */

export type PdfValue =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "name"; readonly value: string }
  | { readonly kind: "string"; readonly value: Buffer }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "null" }
  | { readonly kind: "ref"; readonly num: number; readonly gen: number }
  | { readonly kind: "array"; readonly items: readonly PdfValue[] }
  | { readonly kind: "dict"; readonly entries: ReadonlyMap<string, PdfValue> }
  | { readonly kind: "keyword"; readonly value: string };

export type PdfDict = Extract<PdfValue, { kind: "dict" }>;

const MAX_DEPTH = 256;
const MAX_VALUES = 1_000_000;
const KEPT_TOP_VALUES = 3;

interface Open {
  readonly kind: "array" | "dict";
  readonly items: PdfValue[];
}

const isInteger = (value: PdfValue | undefined): value is { kind: "number"; value: number } =>
  value?.kind === "number" && Number.isInteger(value.value) && value.value >= 0;

function toDict(items: readonly PdfValue[]): PdfDict {
  const entries = new Map<string, PdfValue>();
  for (let index = 0; index + 1 < items.length; index += 2) {
    const key = items[index];
    const value = items[index + 1];
    if (key?.kind === "name" && value) entries.set(key.value, value);
  }
  return { kind: "dict", entries };
}

/** Builds values from tokens; the scanner hands structural keywords (obj, stream…) elsewhere. */
export class PdfBuilder {
  private stack: Open[] = [];
  private values = 0;
  /** The last few complete values at the top level, newest last. */
  top: PdfValue[] = [];

  get depth(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack = [];
    this.top = [];
    this.values = 0;
  }

  /** Adds a token; returns the value it completed at the top level, if any. */
  push(token: PdfToken): PdfValue | null {
    if (token.kind === "open") {
      if (this.stack.length >= MAX_DEPTH) refuse("pdf_unreadable", "objects nested too deeply");
      this.stack.push({ kind: token.value === "<<" ? "dict" : "array", items: [] });
      return null;
    }
    if (token.kind === "close") return this.close(token.value);
    return this.add(this.valueOf(token));
  }

  private valueOf(token: Exclude<PdfToken, { kind: "open" | "close" }>): PdfValue {
    if (token.kind !== "keyword") return token;
    if (token.value === "true" || token.value === "false") {
      return { kind: "bool", value: token.value === "true" };
    }
    if (token.value === "null") return { kind: "null" };
    return token;
  }

  private close(value: ">>" | "]"): PdfValue | null {
    const open = this.stack[this.stack.length - 1];
    if (!open || (open.kind === "dict") !== (value === ">>")) return null;
    this.stack.pop();
    return this.add(
      open.kind === "dict" ? toDict(open.items) : { kind: "array", items: open.items },
    );
  }

  private add(value: PdfValue): PdfValue | null {
    this.values += 1;
    if (this.values > MAX_VALUES) refuse("pdf_unreadable", "an object of over a million values");
    const items = this.stack[this.stack.length - 1]?.items ?? this.top;
    if (value.kind === "keyword" && value.value === "R") {
      const gen = items[items.length - 1];
      const num = items[items.length - 2];
      if (isInteger(num) && isInteger(gen)) {
        items.splice(items.length - 2, 2, { kind: "ref", num: num.value, gen: gen.value });
        return this.stack.length === 0 ? this.trimTop() : null;
      }
    }
    items.push(value);
    if (this.stack.length > 0) return null;
    return this.trimTop();
  }

  private trimTop(): PdfValue | null {
    if (this.top.length > KEPT_TOP_VALUES) this.top.splice(0, this.top.length - KEPT_TOP_VALUES);
    this.values = 0;
    return this.top[this.top.length - 1] ?? null;
  }
}

/** The two integers before an `obj` keyword: the object number and generation. */
export function objectId(top: readonly PdfValue[]): { num: number; gen: number } | null {
  const num = top[top.length - 2];
  const gen = top[top.length - 1];
  return isInteger(num) && isInteger(gen) ? { num: num.value, gen: gen.value } : null;
}

/** A dictionary entry. */
export function entry(dict: PdfDict, key: string): PdfValue | undefined {
  return dict.entries.get(key);
}

export function nameOf(value: PdfValue | undefined): string | null {
  return value?.kind === "name" ? value.value : null;
}

export function numberOf(value: PdfValue | undefined): number | null {
  return value?.kind === "number" ? value.value : null;
}

export function stringOf(value: PdfValue | undefined): Buffer | null {
  return value?.kind === "string" ? value.value : null;
}

export function dictOf(value: PdfValue | undefined): PdfDict | null {
  return value?.kind === "dict" ? value : null;
}
