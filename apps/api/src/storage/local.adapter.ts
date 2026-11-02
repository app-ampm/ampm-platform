import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

  async putObject(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
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
