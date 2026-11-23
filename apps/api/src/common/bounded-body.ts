import type { IncomingHttpHeaders } from "node:http";
import type { Readable } from "node:stream";

import { errors } from "@ampm/core";

/*
 * The shared post-guard body reader (D-176; plan §4.8). A route that takes a file reads its raw body here,
 * inside its handler, so authentication, the rate limit, the permission and the query pipe have all run
 * before a byte is read: a refused caller never makes the API buffer anything. The global raw parser
 * skips these routes (POST_GUARD_PATHS in app-error.filter.ts), and the reader refuses a body some
 * parser already took. It checks the media type, the declared length against the route's cap before
 * reading, the bytes as they stream, and a deadline. Slice 6 moves every upload route onto it.
 */

/** A request whose body has not been read: the express Request, or a stream in a test. */
export type UnreadRequest = Readable & {
  readonly headers: IncomingHttpHeaders;
  readonly body?: unknown;
};

/** What one route accepts. */
export interface BoundedBodyOptions {
  /** The most bytes the route reads; a longer body is refused with 413. */
  readonly limitBytes: number;
  /** The media types it takes, lowercase and without parameters (`text/csv; charset=utf-8` is text/csv). */
  readonly contentTypes: readonly string[];
  /** How long the whole body may take to arrive; one minute unless the route says otherwise. */
  readonly deadlineMs?: number;
}

/** The default time a body may take to arrive. */
export const BODY_DEADLINE_MS = 60_000;

/**
 * Reads a route's raw body after the guards, within its limits: 415 for a media type the route does not
 * take, 400 without a Content-Length, 413 before reading when the declared length is over the cap or as
 * soon as the bytes pass it, 400 when the body is cut off or outlasts the deadline. Whatever is left of a
 * refused body is drained, never kept, so the answer still reaches the caller.
 *
 * @example
 * const bytes = await readBoundedBody(req, { limitBytes: 5 * 1024 * 1024, contentTypes: ["text/csv"] });
 */
export async function readBoundedBody(
  req: UnreadRequest,
  options: BoundedBodyOptions,
): Promise<Buffer> {
  requireMediaType(req, options.contentTypes);
  if (req.body !== undefined || req.readableEnded) {
    // A wiring error, not the caller's: the route is missing from POST_GUARD_PATHS, so a parser read it.
    throw errors.internal("The request body was read before its route could check it");
  }
  if (declaredLength(req) > options.limitBytes) throw tooLarge(options.limitBytes);
  if (req.destroyed) throw cutOff();
  return new Promise<Buffer>((resolve, reject) => {
    new BoundedRead(req, options.limitBytes, { resolve, reject }).start(
      options.deadlineMs ?? BODY_DEADLINE_MS,
    );
  });
}

function requireMediaType(req: UnreadRequest, accepted: readonly string[]): void {
  const mediaType = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!accepted.includes(mediaType)) {
    throw errors.unsupportedMediaType(`Send the file as ${accepted.join(" or ")}`);
  }
}

/** The body's declared length; a chunked or unsized body is refused, since its size is unknown. */
function declaredLength(req: UnreadRequest): number {
  const header = req.headers["content-length"];
  if (header === undefined || !/^\d+$/.test(header)) {
    throw errors.validation([], "Send the file with its length (a Content-Length header)");
  }
  return Number(header);
}

function tooLarge(limitBytes: number): Error {
  const mebibytes = Math.floor(limitBytes / (1024 * 1024));
  return errors.payloadTooLarge(`The file is larger than ${mebibytes} MB`);
}

function cutOff(): Error {
  return errors.validation([], "The upload was cut off; send it again");
}

/** One body being read: the chunks so far, and the listeners that end the read one way or another. */
class BoundedRead {
  private readonly chunks: Buffer[] = [];
  private received = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly req: UnreadRequest,
    private readonly limitBytes: number,
    private readonly settle: {
      readonly resolve: (body: Buffer) => void;
      readonly reject: (error: Error) => void;
    },
  ) {}

  start(deadlineMs: number): void {
    this.timer = setTimeout(
      () => this.stop(errors.validation([], "The upload took too long; send it again")),
      deadlineMs,
    );
    this.req.on("data", this.onData);
    this.req.once("end", this.onEnd);
    this.req.once("error", this.onCutOff);
    this.req.once("close", this.onCutOff);
  }

  private readonly onData = (chunk: Buffer | string): void => {
    const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    this.received += bytes.length;
    if (this.received > this.limitBytes) {
      this.stop(tooLarge(this.limitBytes));
      return;
    }
    this.chunks.push(bytes);
  };

  private readonly onEnd = (): void => {
    this.detach();
    this.settle.resolve(Buffer.concat(this.chunks, this.received));
  };

  private readonly onCutOff = (): void => this.stop(cutOff());

  /**
   * Gives up on the body: whatever is left keeps flowing and is dropped, so the caller can finish sending
   * and read the answer, and an error while draining has no one left to tell.
   */
  private stop(error: Error): void {
    this.detach();
    this.chunks.length = 0;
    this.req.on("error", () => undefined);
    this.req.resume();
    this.settle.reject(error);
  }

  private detach(): void {
    clearTimeout(this.timer);
    this.req.off("data", this.onData);
    this.req.off("end", this.onEnd);
    this.req.off("error", this.onCutOff);
    this.req.off("close", this.onCutOff);
  }
}
