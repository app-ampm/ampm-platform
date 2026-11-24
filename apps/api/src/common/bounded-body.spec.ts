import type { IncomingHttpHeaders } from "node:http";
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { octetStreamBody, readBoundedBody, type BoundedBodyOptions } from "./bounded-body.js";

const CSV_ONLY: BoundedBodyOptions = { limitBytes: 16, contentTypes: ["text/csv"] };

/** A request whose body streams these chunks, with these headers; it counts the reads asked of it. */
function request(chunks: readonly string[], headers: IncomingHttpHeaders, body?: unknown) {
  const pending = [...chunks];
  const counter = { reads: 0 };
  const stream = new Readable({
    read() {
      counter.reads++;
      const next = pending.shift();
      this.push(next === undefined ? null : Buffer.from(next));
    },
  });
  return { req: Object.assign(stream, { headers, body }), counter };
}

const sized = (text: string, type = "text/csv"): IncomingHttpHeaders => ({
  "content-type": type,
  "content-length": String(Buffer.byteLength(text)),
});

describe("readBoundedBody", () => {
  it("reads a body within the cap, whatever the media type's parameters", async () => {
    const { req } = request(["name\n", "Cove"], sized("name\nCove", "text/csv; charset=utf-8"));
    await expect(readBoundedBody(req, CSV_ONLY)).resolves.toEqual(Buffer.from("name\nCove"));
  });

  it("refuses a media type the route does not take with 415, before reading", async () => {
    const { req, counter } = request(['{"a":1}'], sized('{"a":1}', "application/json"));
    await expect(readBoundedBody(req, CSV_ONLY)).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
    });
    expect(counter.reads).toBe(0);
  });

  it("refuses a declared length over the cap with 413 without reading a byte", async () => {
    const { req, counter } = request(["x".repeat(17)], sized("x".repeat(17)));
    await expect(readBoundedBody(req, CSV_ONLY)).rejects.toMatchObject({
      code: "payload_too_large",
      status: 413,
    });
    expect(counter.reads).toBe(0);
  });

  it("refuses a body with no length (chunked) with 400", async () => {
    const { req } = request(["name"], {
      "content-type": "text/csv",
      "transfer-encoding": "chunked",
    });
    await expect(readBoundedBody(req, CSV_ONLY)).rejects.toMatchObject({
      code: "validation_failed",
    });
  });

  it("stops at the cap while streaming, whatever the length said, and drains the rest", async () => {
    const { req } = request(["x".repeat(10), "x".repeat(10), "x".repeat(10)], {
      "content-type": "text/csv",
      "content-length": "8",
    });
    const drained = new Promise((resolve) => req.once("end", resolve));
    await expect(readBoundedBody(req, CSV_ONLY)).rejects.toMatchObject({ status: 413 });
    await drained;
    expect(req.readableEnded).toBe(true);
  });

  it("takes raw bytes only on an upload route, within its cap (D-187)", async () => {
    const options = octetStreamBody(8);
    expect(options).toEqual({ limitBytes: 8, contentTypes: ["application/octet-stream"] });
    const { req } = request(["%PDF"], sized("%PDF", "application/octet-stream"));
    await expect(readBoundedBody(req, options)).resolves.toEqual(Buffer.from("%PDF"));
    const csv = request(["a,b"], sized("a,b", "text/csv"));
    await expect(readBoundedBody(csv.req, options)).rejects.toMatchObject({ status: 415 });
  });

  it("refuses a body a parser already read: a wiring error, never the caller's", async () => {
    const { req } = request(["name"], sized("name"), Buffer.from("name"));
    await expect(readBoundedBody(req, CSV_ONLY)).rejects.toMatchObject({ code: "internal" });
  });

  it("gives up on a body that outlasts the deadline", async () => {
    const stream = new Readable({ read() {} });
    const req = Object.assign(stream, { headers: sized("name"), body: undefined });
    await expect(readBoundedBody(req, { ...CSV_ONLY, deadlineMs: 20 })).rejects.toMatchObject({
      code: "validation_failed",
      message: expect.stringMatching(/too long/),
    });
  });

  it("refuses a body cut off before its end", async () => {
    const stream = new Readable({ read() {} });
    const req = Object.assign(stream, { headers: sized("name"), body: undefined });
    const reading = readBoundedBody(req, CSV_ONLY);
    stream.destroy();
    await expect(reading).rejects.toMatchObject({ message: expect.stringMatching(/cut off/) });
  });
});
