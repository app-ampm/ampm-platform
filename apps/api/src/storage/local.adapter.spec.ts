import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LocalStorageAdapter } from "./local.adapter.js";

const SECRET = "test-media-signing-secret-at-least-32-chars";

/** Parses the `key`/`exp`/`sig` a signed URL carries so the test can replay them against verifyDownload. */
function parse(url: string): { key: string; exp: number; sig: string } {
  const query = new URLSearchParams(url.slice(url.indexOf("?") + 1));
  return { key: query.get("key")!, exp: Number(query.get("exp")), sig: query.get("sig")! };
}

describe("LocalStorageAdapter", () => {
  let dir: string;
  let store: LocalStorageAdapter;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "ampm-storage-"));
    store = new LocalStorageAdapter(dir, SECRET);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips bytes under a nested key", async () => {
    const body = Buffer.from("a synthetic jpeg");
    await store.putObject("hotels/abc/photo.jpg", body, "image/jpeg");
    expect(await store.getObject("hotels/abc/photo.jpg")).toEqual(body);
  });

  it("404s a missing key and deletes idempotently", async () => {
    await expect(store.getObject("nope/missing.jpg")).rejects.toMatchObject({ code: "not_found" });
    await store.deleteObject("nope/missing.jpg"); // no-op, no throw
    await store.putObject("tmp/x.bin", Buffer.from("x"), "application/octet-stream");
    await store.deleteObject("tmp/x.bin");
    await expect(store.getObject("tmp/x.bin")).rejects.toMatchObject({ code: "not_found" });
  });

  it("signs a download URL that verifies, and rejects a tampered or wrong-key one", () => {
    const signed = store.signDownloadUrl("hotels/abc/photo.jpg", 900);
    const { key, exp, sig } = parse(signed.url);
    expect(signed.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(store.verifyDownload(key, exp, sig)).toBe(true);
    expect(store.verifyDownload(key, exp, sig.replace(/.$/, "0"))).toBe(false); // tampered signature
    expect(store.verifyDownload("hotels/abc/other.jpg", exp, sig)).toBe(false); // signature is key-bound
  });

  it("rejects an expired signed URL", () => {
    const signed = store.signDownloadUrl("hotels/abc/photo.jpg", -1); // already in the past
    const { key, exp, sig } = parse(signed.url);
    expect(store.verifyDownload(key, exp, sig)).toBe(false);
  });

  it("refuses a key that escapes the base directory", async () => {
    await expect(store.putObject("../escape.jpg", Buffer.from("x"), "image/jpeg")).rejects.toThrow(
      "invalid storage key",
    );
  });
});
