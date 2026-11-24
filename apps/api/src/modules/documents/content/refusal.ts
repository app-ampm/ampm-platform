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
 * A value the file chose (a part name, a link's target, a content type, a filter's name, a declared
 * number), quoted and escaped so that the log line always masks it (`loggableDetail` masks every quoted
 * value): a refusal's detail names the rule it broke, never what the file said. refusal.spec.ts fails on
 * any interpolation in a detail that does not come through here, unless it lists the value as one the
 * checks decided or measured.
 *
 * @example
 * refuse("archive_unsafe", `a part with no content type: ${fromFile(entry.name)}`);
 */
export function fromFile(value: string | number): string {
  return JSON.stringify(String(value));
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
