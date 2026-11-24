import type { UploadRefusalReason } from "@ampm/core";

/*
 * How the content readers stop: a reader that finds a rule broken throws a `ContentRefusal`, and the one
 * entry point (inspect-content.ts) turns it into a result. A deep reader can then stop at the first broken
 * rule without threading a result through every helper.
 */

export class ContentRefusal extends Error {
  readonly reason: UploadRefusalReason;
  readonly detail: string;

  constructor(reason: UploadRefusalReason, detail: string) {
    super(`${reason}: ${detail}`);
    this.name = "ContentRefusal";
    this.reason = reason;
    this.detail = detail;
  }
}

/** Stops the checks with a refusal. */
export function refuse(reason: UploadRefusalReason, detail: string): never {
  throw new ContentRefusal(reason, detail);
}

/**
 * Refuses as damaged unless `length` bytes from `offset` lie inside `bytes`: every read of a declared
 * offset or size goes through here first, so a lying header can never point a read outside the file.
 */
export function need(bytes: Buffer, offset: number, length: number, what: string): void {
  const inside =
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(length) &&
    offset >= 0 &&
    length >= 0 &&
    offset + length <= bytes.length;
  if (!inside) refuse("file_damaged", `${what} lies outside the file`);
}
