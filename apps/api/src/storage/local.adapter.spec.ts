import { link, mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
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
  let snapshots: string;
  let store: LocalStorageAdapter;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "ampm-storage-"));
    // Beside the store in the same temporary directory, so on its filesystem: a hard link cannot cross one.
    snapshots = await mkdtemp(join(tmpdir(), "ampm-snapshots-"));
    store = new LocalStorageAdapter(dir, SECRET);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(snapshots, { recursive: true, force: true });
  });

  it("round-trips bytes under a nested key", async () => {
    const body = Buffer.from("a synthetic jpeg");
    await store.putObject("hotels/abc/photo.jpg", body, "image/jpeg");
    expect(await store.getObject("hotels/abc/photo.jpg")).toEqual(body);
  });

  it("replaces a rewritten key with a new file, so a snapshot's hard link keeps the version it linked", async () => {
    const key = "hotel/h1/a1";
    await store.putObject(key, Buffer.from("synthetic photo, version 1"), "image/jpeg");
    // What the nightly media snapshot does (deploy/app-ampmverse/backup-media.sh, `cp -al`).
    const linked = join(snapshots, "a1");
    await link(join(dir, key), linked);

    await store.putObject(key, Buffer.from("synthetic photo, version 2"), "image/jpeg");

    expect(await readFile(linked, "utf8")).toBe("synthetic photo, version 1");
    expect((await store.getObject(key)).toString("utf8")).toBe("synthetic photo, version 2");
    expect((await stat(join(dir, key))).ino).not.toBe((await stat(linked)).ino);
    expect(await readdir(join(dir, "hotel/h1"))).toEqual(["a1"]); // no temporary file left behind
  });

  it("leaves no temporary file when a write fails, and passes the failure on", async () => {
    // A directory where the key's file belongs: the bytes are written, then the rename over the key fails.
    await mkdir(join(dir, "hotel/h2/a2"), { recursive: true });

    await expect(
      store.putObject("hotel/h2/a2", Buffer.from("synthetic photo"), "image/jpeg"),
    ).rejects.toMatchObject({ code: "EISDIR" });

    expect(await readdir(join(dir, "hotel/h2"))).toEqual(["a2"]);
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
    // Flip the last character to a definitely-different one: replacing it with a fixed "0" left the
    // signature unchanged (and the tamper undetected) on the ~1/16 of runs where sig already ended in "0".
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === "0" ? "1" : "0");
    expect(store.verifyDownload(key, exp, tamperedSig)).toBe(false); // tampered signature
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
