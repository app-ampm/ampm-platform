/**
 * The object-store seam (feature 9.3, AC-20). One adapter interface, one implementation behind it, a
 * dev/local implementation and (from feature 6.4) the Mumbai S3 bucket + CDN — api.md's integration rule.
 * Business logic never touches a bucket SDK; it depends on this port. Files are never public paths: a
 * download is reached only through a short-lived signed URL this port mints and verifies (security.md).
 */

/** A time-boxed, tamper-evident link to one object (never a permanent path; AC-20, 15-minute default). */
export interface SignedUrl {
  /** The URL the client fetches — relative to the API origin for the local store, absolute for a CDN. */
  readonly url: string;
  readonly expiresAt: Date;
}

export interface StorageAdapter {
  /** Writes the object's bytes under `key`, creating the container as needed. Overwrites an existing key. */
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Reads the object's bytes; throws `notFound` when the key is absent (the download path and the scan job). */
  getObject(key: string): Promise<Buffer>;
  /** Removes the object; a missing key is a no-op so a re-run is idempotent. */
  deleteObject(key: string): Promise<void>;
  /** A signed URL to download `key`, valid for `ttlSeconds` — the only way bytes leave the store (AC-20). */
  signDownloadUrl(key: string, ttlSeconds: number): SignedUrl;
  /** Verifies a signed-download request: `key`-bound, not past `expiresAtEpoch`, signature intact. */
  verifyDownload(key: string, expiresAtEpoch: number, signature: string): boolean;
}

export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");
