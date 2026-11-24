import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

import {
  dictOf,
  entry,
  nameOf,
  numberOf,
  type PdfDict,
  type PdfValue,
  stringOf,
} from "./pdf-objects.js";
import { rc4 } from "./rc4.js";
import { refuse } from "./refusal.js";

/*
 * The PDF standard security handler (ISO 32000-2 §7.6.4), enough to open a file with the empty user
 * password: RC4 at 40 to 128 bits (revisions 2 to 4), AES-128 (V4, AESV2) and AES-256 (V5, revisions 5
 * and 6 with algorithm 2.B). A permission-locked file (an owner password only) opens; one that needs a
 * password to open is refused, and so is any other security handler. Nothing is ever encrypted here.
 */

/** The 32-byte padding of algorithm 2 (ISO 32000-2 §7.6.4.3.2, step a). */
export const PASSWORD_PADDING = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);

export type CryptMethod = "none" | "rc4" | "aes128" | "aes256";

export interface PdfDecryptor {
  /** Decrypts the data of a stream in object `num` generation `gen`. */
  decryptStream(num: number, gen: number, data: Buffer): Buffer;
}

const md5 = (...parts: Buffer[]): Buffer => createHash("md5").update(Buffer.concat(parts)).digest();
const sha = (algorithm: string, ...parts: Buffer[]): Buffer =>
  createHash(algorithm).update(Buffer.concat(parts)).digest();

function int32Le(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeInt32LE(value | 0, 0);
  return out;
}

/** Algorithm 2: the file key from the (empty) user password, revisions 2 to 4. */
export function legacyFileKey(dict: PdfDict, id0: Buffer, keyBytes: number): Buffer {
  const revision = numberOf(entry(dict, "R")) ?? 0;
  const owner = (stringOf(entry(dict, "O")) ?? Buffer.alloc(0)).subarray(0, 32);
  const metadata = entry(dict, "EncryptMetadata");
  const skipsMetadata = revision >= 4 && metadata?.kind === "bool" && !metadata.value;
  let hash = md5(
    PASSWORD_PADDING,
    owner,
    int32Le(numberOf(entry(dict, "P")) ?? 0),
    id0,
    skipsMetadata ? Buffer.from([0xff, 0xff, 0xff, 0xff]) : Buffer.alloc(0),
  );
  if (revision >= 3) {
    for (let round = 0; round < 50; round += 1) hash = md5(hash.subarray(0, keyBytes));
  }
  return hash.subarray(0, keyBytes);
}

/** Algorithms 4 and 5: whether `key` is the empty user password's key. */
export function legacyUserMatches(dict: PdfDict, id0: Buffer, key: Buffer): boolean {
  const user = stringOf(entry(dict, "U")) ?? Buffer.alloc(0);
  if ((numberOf(entry(dict, "R")) ?? 0) === 2) {
    return rc4(key, PASSWORD_PADDING).equals(user.subarray(0, 32));
  }
  let value = rc4(key, md5(PASSWORD_PADDING, id0));
  for (let round = 1; round <= 19; round += 1) {
    value = rc4(
      key.map((byte) => byte ^ round),
      value,
    );
  }
  return value.equals(user.subarray(0, 16));
}

/** Algorithm 2.B (ISO 32000-2 §7.6.4.3.4): the revision 6 hash of a password, salt and user key. */
export function hashR6(password: Buffer, salt: Buffer, userKey: Buffer): Buffer {
  let key = sha("sha256", password, salt, userKey);
  let round = 0;
  let last = 0;
  while (round < 64 || last > round - 32) {
    const block = Buffer.concat([password, key, userKey]);
    const repeated = Buffer.concat(Array.from({ length: 64 }, () => block));
    const cipher = createCipheriv("aes-128-cbc", key.subarray(0, 16), key.subarray(16, 32));
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(repeated), cipher.final()]);
    const remainder = encrypted.subarray(0, 16).reduce((sum, byte) => sum + byte, 0) % 3;
    key = sha(["sha256", "sha384", "sha512"][remainder] ?? "sha256", encrypted);
    last = encrypted[encrypted.length - 1] ?? 0;
    round += 1;
  }
  return key.subarray(0, 32);
}

function aesNoPadding(algorithm: string, key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** Algorithm 2.A: the AES-256 file key from the empty user password, or null when it does not open. */
export function aes256FileKey(dict: PdfDict): Buffer | null {
  const user = stringOf(entry(dict, "U")) ?? Buffer.alloc(0);
  const userKey = stringOf(entry(dict, "UE")) ?? Buffer.alloc(0);
  if (user.length < 48 || userKey.length < 32) return null;
  const isR6 = (numberOf(entry(dict, "R")) ?? 0) === 6;
  const empty = Buffer.alloc(0);
  const hash = (salt: Buffer): Buffer => (isR6 ? hashR6(empty, salt, empty) : sha("sha256", salt));
  if (!hash(user.subarray(32, 40)).equals(user.subarray(0, 32))) return null;
  return aesNoPadding(
    "aes-256-cbc",
    hash(user.subarray(40, 48)),
    Buffer.alloc(16),
    userKey.subarray(0, 32),
  );
}

/** Decrypts AES-CBC data that carries its IV in front, removing valid PKCS#7 padding. */
export function aesDecrypt(key: Buffer, data: Buffer): Buffer {
  if (data.length < 32) return Buffer.alloc(0);
  const body = data.subarray(16, 16 + Math.floor((data.length - 16) / 16) * 16);
  const algorithm = key.length === 32 ? "aes-256-cbc" : "aes-128-cbc";
  const plain = aesNoPadding(algorithm, key, data.subarray(0, 16), body);
  const pad = plain[plain.length - 1] ?? 0;
  const padded =
    pad >= 1 && pad <= 16 && plain.subarray(plain.length - pad).every((byte) => byte === pad);
  return padded ? plain.subarray(0, plain.length - pad) : plain;
}

/** The method a stream uses: V1 and V2 use RC4; V4 and V5 name a crypt filter (Identity is none). */
function streamMethod(dict: PdfDict, version: number): CryptMethod {
  if (version === 1 || version === 2) return "rc4";
  const filterName = nameOf(entry(dict, "StmF")) ?? "Identity";
  if (filterName === "Identity") return "none";
  const filters = dictOf(entry(dict, "CF"));
  const filter = filters ? dictOf(filters.entries.get(filterName)) : null;
  const method = nameOf(filter ? entry(filter, "CFM") : undefined) ?? "None";
  const methods: Readonly<Record<string, CryptMethod>> = {
    None: "none",
    V2: "rc4",
    AESV2: "aes128",
    AESV3: "aes256",
  };
  return methods[method] ?? refuse("pdf_unreadable", `a crypt filter method ${method}`);
}

function objectKey(fileKey: Buffer, num: number, gen: number, aes: boolean): Buffer {
  const id = Buffer.from([
    num & 0xff,
    (num >> 8) & 0xff,
    (num >> 16) & 0xff,
    gen & 0xff,
    (gen >> 8) & 0xff,
  ]);
  const salt = aes ? Buffer.from("sAlT", "latin1") : Buffer.alloc(0);
  return md5(fileKey, id, salt).subarray(0, Math.min(fileKey.length + 5, 16));
}

/** The file key from the empty user password, or a refusal for a file that needs a password. */
function fileKey(dict: PdfDict, version: number, id0: Buffer): Buffer {
  if (version === 5) {
    return (
      aes256FileKey(dict) ?? refuse("password_protected", "a PDF that needs a password to open")
    );
  }
  const bits = version === 1 ? 40 : version === 4 ? 128 : (numberOf(entry(dict, "Length")) ?? 40);
  if (bits < 40 || bits > 128 || bits % 8 !== 0) refuse("pdf_unreadable", `a ${bits}-bit RC4 key`);
  const key = legacyFileKey(dict, id0, bits / 8);
  if (!legacyUserMatches(dict, id0, key))
    refuse("password_protected", "a PDF that needs a password to open");
  return key;
}

/**
 * Opens a PDF's encryption with the empty user password.
 *
 * @example
 * const decryptor = openEncryption(encryptDict, fileId);
 * const plain = decryptor.decryptStream(12, 0, streamBytes);
 */
export function openEncryption(dict: PdfDict, id0: Buffer): PdfDecryptor {
  const handler = nameOf(entry(dict, "Filter"));
  if (handler !== "Standard")
    refuse("password_protected", `the ${handler ?? "unnamed"} security handler`);
  const version = numberOf(entry(dict, "V")) ?? 0;
  const revision = numberOf(entry(dict, "R")) ?? 0;
  const known = [1, 2, 4].includes(version)
    ? revision >= 2 && revision <= 4
    : version === 5 && [5, 6].includes(revision);
  if (!known) refuse("pdf_unreadable", `an encryption it cannot read (V${version} R${revision})`);
  const key = fileKey(dict, version, id0);
  const method = streamMethod(dict, version);
  return {
    decryptStream(num: number, gen: number, data: Buffer): Buffer {
      if (method === "none") return data;
      if (method === "aes256") return aesDecrypt(key, data);
      if (method === "aes128") return aesDecrypt(objectKey(key, num, gen, true), data);
      return rc4(objectKey(key, num, gen, false), data);
    },
  };
}

/** The first file identifier, which keys revisions 2 to 4; empty when the trailer has none. */
export function firstFileId(id: PdfValue | undefined): Buffer {
  if (id?.kind !== "array") return Buffer.alloc(0);
  return stringOf(id.items[0]) ?? Buffer.alloc(0);
}
