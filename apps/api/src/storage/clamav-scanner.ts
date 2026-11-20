import { connect } from "node:net";
import { errors, type Logger } from "@ampm/core";

import type { AvScanner } from "./av-scanner.js";

/** Where clamd listens, and how long one scan may take end to end: connect, stream, scan, verdict. */
export interface ClamAvOptions {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs: number;
}

/** What the uploader is told when no verdict could be had: nothing was stored, and a retry is safe. */
export const SCANNER_UNAVAILABLE =
  "The virus scanner is unavailable, so the file was not stored. Try again in a minute.";

/** clamd takes a stream as length-prefixed chunks; 64 KiB keeps each one far below its limits. */
const CHUNK_BYTES = 64 * 1024;
/** A verdict is one short line; a longer answer is not clamd's. */
const MAX_REPLY_BYTES = 1024;

/** The slice of the logger this adapter needs. */
type ScanLogger = Pick<Logger, "warn">;

/**
 * The production antivirus scan (AC-20.3; security.md: no file is downloadable before it passes). Each
 * upload is streamed to a clamd daemon over TCP with the INSTREAM command, on a connection of its own, so
 * the API holds no ClamAV library and the file never touches the scanner's disk. Fail closed: only clamd's
 * exact `stream: OK` is clean, and `stream: <signature> FOUND` is rejected. A connection error, a timeout,
 * a clamd ERROR (its stream size limit, a reload) or any other answer gives no verdict, so the scan throws
 * a 503 before the caller has stored anything: the upload can simply be retried, and an existing clean
 * file is never touched. Contract-tested against a fake clamd (clamav-scanner.spec.ts).
 */
export class ClamAvScanner implements AvScanner {
  constructor(
    private readonly options: ClamAvOptions,
    private readonly logger: ScanLogger,
  ) {}

  async scan(bytes: Buffer): Promise<"clean" | "rejected"> {
    const reply = await this.ask(bytes);
    if (reply === "stream: OK") return "clean";
    const found = /^stream: (.+) FOUND$/.exec(reply);
    if (found) {
      this.logger.warn("storage.av_scan.threat_found", { signature: found[1] ?? "" });
      return "rejected";
    }
    this.logger.warn("storage.av_scan.no_verdict", { reply: reply.slice(0, 120) });
    throw errors.unavailable(SCANNER_UNAVAILABLE);
  }

  private async ask(bytes: Buffer): Promise<string> {
    try {
      return await instream(bytes, this.options);
    } catch (error) {
      this.logger.warn("storage.av_scan.unavailable", { error: String(error) });
      throw errors.unavailable(SCANNER_UNAVAILABLE);
    }
  }
}

/**
 * One INSTREAM exchange. clamd answers a `z`-command with one NUL-terminated line and then closes; the
 * deadline covers the whole exchange, so a daemon that accepts and then stalls cannot hold the upload.
 */
function instream(bytes: Buffer, { host, port, timeoutMs }: ClamAvOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    // Destroying with an error emits it, so the timeout settles through the error handler below.
    const deadline = setTimeout(
      () => socket.destroy(new Error(`clamd gave no verdict within ${timeoutMs} ms`)),
      timeoutMs,
    );
    let reply = Buffer.alloc(0);
    const settle = (error: Error | null, verdict = ""): void => {
      clearTimeout(deadline);
      socket.destroy();
      if (error) reject(error);
      else resolve(verdict);
    };
    socket.once("connect", () => {
      for (const frame of frames(bytes)) socket.write(frame);
    });
    socket.on("data", (chunk: Buffer) => {
      reply = Buffer.concat([reply, chunk]);
      const end = reply.indexOf(0);
      if (end >= 0) settle(null, reply.subarray(0, end).toString("utf8").trim());
      else if (reply.length > MAX_REPLY_BYTES) settle(new Error("clamd's reply is too long"));
    });
    // `on`, not `once`: a second error after the first must not go unhandled. Settling twice is a no-op.
    socket.on("error", (error) => settle(error));
    socket.once("close", () => settle(new Error("clamd closed the connection without a verdict")));
  });
}

/** The INSTREAM framing: the command, each chunk behind its 4-byte big-endian length, a zero length. */
function* frames(bytes: Buffer): Generator<Buffer> {
  yield Buffer.from("zINSTREAM\0");
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + CHUNK_BYTES);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(chunk.length);
    yield length;
    yield chunk;
  }
  yield Buffer.alloc(4);
}
