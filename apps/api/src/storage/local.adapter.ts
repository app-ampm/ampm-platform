import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

import { errors } from "@ampm/core";

import type { SignedUrl, StorageAdapter } from "./storage.types.js";

/** The download route the signed URL points at; the media download controller serves it (feature 9.3). */
const DOWNLOAD_PATH = "/media/blob";

/**
 * The development and staging object store (feature 9.3): bytes on the local filesystem under a base
 * directory, downloads behind an HMAC-signed, expiring URL served by the API itself (no CDN in dev).
 * Production is refused in env.ts (the C1 pattern); the S3 bucket + CDN is feature 6.4. The signing key
 * is media's own (security.md three-key rule); an empty key is only ever reached in local dev.
 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly baseDir: string,
    private readonly signingSecret: string,
  ) {}

  /**
   * Every write is a new file renamed over the key, never a rewrite of the old one. The nightly media
   * snapshots hard-link the live files (deploy/app-ampmverse/backup-media.sh, D-177), so rewriting a file
   * in place would change the copy every snapshot shares, and a crash mid-write would truncate it in all
   * of them; a reader mid-download keeps the file it opened. The temporary sibling sits in the key's own
   * directory, so the rename stays on one filesystem and is atomic. Media originals, their `.web` and
   * `.thumb` derivatives and documents are all written here.
   */
  async putObject(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, body, { flag: "wx" });
      await rename(temporary, path);
    } catch (error) {
      // Best effort: the write's own error is the one to pass on.
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch {
      throw errors.notFound();
    }
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  signDownloadUrl(key: string, ttlSeconds: number): SignedUrl {
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.sign(key, expiresAtEpoch);
    const query = `key=${encodeURIComponent(key)}&exp=${expiresAtEpoch}&sig=${signature}`;
    return { url: `${DOWNLOAD_PATH}?${query}`, expiresAt: new Date(expiresAtEpoch * 1000) };
  }

  verifyDownload(key: string, expiresAtEpoch: number, signature: string): boolean {
    if (!Number.isSafeInteger(expiresAtEpoch) || expiresAtEpoch * 1000 <= Date.now()) return false;
    const expected = this.sign(key, expiresAtEpoch);
    const given = Buffer.from(signature);
    const want = Buffer.from(expected);
    // Length-check first: timingSafeEqual throws on unequal lengths.
    return given.length === want.length && timingSafeEqual(given, want);
  }

  private sign(key: string, expiresAtEpoch: number): string {
    return createHmac("sha256", this.signingSecret)
      .update(`${key}.${expiresAtEpoch}`)
      .digest("hex");
  }

  /** Resolves `key` under the base directory and rejects any traversal outside it (`..`, absolute keys). */
  private resolveKey(key: string): string {
    const path = resolve(this.baseDir, key);
    const root = resolve(this.baseDir);
    // Keys are server-generated and downloads are HMAC-verified, so a traversal here is an invariant
    // breach or an attack, not user input — a plain throw, never a 400.
    if (path !== root && !path.startsWith(root + sep)) throw new Error("invalid storage key");
    return join(path);
  }
}
