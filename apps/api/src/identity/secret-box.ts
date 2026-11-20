import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets at rest (the staff authenticator secrets, D-142) with AES-256-GCM under one
 * 32-byte key: `v1.` + base64url(iv | tag | ciphertext). A tampered or foreign value fails to open.
 *
 * @example
 * const box = new SecretBox(keyFromBase64(env.AUTH_ENCRYPTION_KEY));
 * const stored = box.seal(secret); // later: box.open(stored) === secret
 */
const VERSION = "v1.";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class SecretBox {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("SecretBox needs a 32-byte key");
  }

  seal(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return VERSION + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  }

  open(sealed: string): string {
    if (!sealed.startsWith(VERSION)) throw new Error("unknown secret format");
    const raw = Buffer.from(sealed.slice(VERSION.length), "base64url");
    const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  }
}

/** A key from its base64 form (AUTH_ENCRYPTION_KEY); must decode to exactly 32 bytes. */
export function keyFromBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

/**
 * A key derived from another secret for one purpose (HKDF-SHA256). The local development provider has
 * no AUTH_ENCRYPTION_KEY, so it derives one from its token secret under its own label.
 */
export function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "ampm", purpose, 32));
}
