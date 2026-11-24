import { createCipheriv, createHash } from "node:crypto";

import { hashR6, PASSWORD_PADDING } from "../pdf-crypt.js";
import { rc4 } from "../rc4.js";

/*
 * The standard security handler's writing side (ISO 32000-2 §7.6.4, algorithms 2 to 10), for the specs'
 * PDFs and the fixture generator: RC4 40 and 128-bit, AES-128 and AES-256 (revisions 5 and 6), with a
 * user password or only an owner password. Salts, IVs and file keys are fixed, so the output is
 * repeatable. The generator checks its AES-256 output opens in PDFKit, which keeps this writer honest.
 * Test-only: the build leaves `testing/` folders out.
 */

export type TestCipher =
  "rc4-40-r2" | "rc4-40-r3" | "rc4-128" | "aes-128" | "aes-256-r5" | "aes-256-r6";

export interface TestEncryption {
  readonly cipher: TestCipher;
  readonly userPassword?: string;
  readonly ownerPassword?: string;
}

export interface Encrypted {
  /** The encryption dictionary in PDF syntax. */
  readonly dictionary: string;
  encryptStream(num: number, gen: number, data: Buffer): Buffer;
}

const PERMISSIONS = -3904;
const hex = (bytes: Buffer): string => `<${bytes.toString("hex")}>`;
const md5 = (...parts: Buffer[]): Buffer => createHash("md5").update(Buffer.concat(parts)).digest();
const padded = (password: string): Buffer =>
  Buffer.concat([Buffer.from(password, "latin1"), PASSWORD_PADDING]).subarray(0, 32);

function aesCbc(key: Buffer, iv: Buffer, data: Buffer, padding: boolean): Buffer {
  const cipher = createCipheriv(key.length === 32 ? "aes-256-cbc" : "aes-128-cbc", key, iv);
  cipher.setAutoPadding(padding);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function int32Le(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeInt32LE(value, 0);
  return out;
}

/** RC4 under `key`, then (revision 3 and later) 19 more passes under `key` XOR the pass number. */
function rc4Rounds(key: Buffer, data: Buffer, revision: number): Buffer {
  let value = rc4(key, data);
  if (revision < 3) return value;
  for (let round = 1; round <= 19; round += 1)
    value = rc4(
      key.map((byte) => byte ^ round),
      value,
    );
  return value;
}

/** MD5, then (revision 3 and later) 50 more MD5s of the first `bytes` bytes. */
function md5Rounds(first: Buffer, bytes: number, revision: number): Buffer {
  let hash = first;
  if (revision >= 3)
    for (let round = 0; round < 50; round += 1) hash = md5(hash.subarray(0, bytes));
  return hash.subarray(0, bytes);
}

/** Algorithms 3, 2, 4 and 5: the O value, the file key and the U value, revisions 2 to 4. */
function legacyKeys(spec: TestEncryption, id0: Buffer, revision: number, bytes: number) {
  const user = spec.userPassword ?? "";
  const ownerKey = md5Rounds(md5(padded(spec.ownerPassword || user)), 16, revision).subarray(
    0,
    bytes,
  );
  const owner = rc4Rounds(ownerKey, padded(user), revision);
  const fileKey = md5Rounds(md5(padded(user), owner, int32Le(PERMISSIONS), id0), bytes, revision);
  const userValue =
    revision === 2
      ? rc4(fileKey, PASSWORD_PADDING)
      : Buffer.concat([rc4Rounds(fileKey, md5(PASSWORD_PADDING, id0), revision), Buffer.alloc(16)]);
  return { owner, fileKey, userValue };
}

function legacy(spec: TestEncryption, id0: Buffer): Encrypted {
  const revision = spec.cipher === "rc4-40-r2" ? 2 : spec.cipher === "aes-128" ? 4 : 3;
  const bytes = spec.cipher.startsWith("rc4-40") ? 5 : 16;
  const { owner, fileKey, userValue } = legacyKeys(spec, id0, revision, bytes);
  const aes = spec.cipher === "aes-128";
  const version = revision === 2 ? 1 : aes ? 4 : 2;
  const filters = aes
    ? "/CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV2 /Length 16 >> >> /StmF /StdCF /StrF /StdCF"
    : "";
  return {
    dictionary: `<< /Filter /Standard /V ${version} /R ${revision} /Length ${bytes * 8} ${filters} /O ${hex(owner)} /U ${hex(userValue)} /P ${PERMISSIONS} >>`,
    encryptStream(num, gen, data) {
      const id = Buffer.from([
        num & 0xff,
        (num >> 8) & 0xff,
        (num >> 16) & 0xff,
        gen & 0xff,
        (gen >> 8) & 0xff,
      ]);
      const key = md5(fileKey, id, aes ? Buffer.from("sAlT") : Buffer.alloc(0)).subarray(
        0,
        Math.min(bytes + 5, 16),
      );
      if (!aes) return rc4(key, data);
      const iv = Buffer.alloc(16, 7);
      return Buffer.concat([iv, aesCbc(key, iv, data, true)]);
    },
  };
}

/**
 * Algorithms 8 and 9: a password's validation hash and key salt (48 bytes) and its encrypted copy of
 * the file key (32 bytes). The owner's are keyed to the user's 48 bytes; the user's to nothing.
 */
function aes256Password(
  hash: (password: string, salt: Buffer, userKey: Buffer) => Buffer,
  password: string,
  seeds: [number, number],
  fileKey: Buffer,
  userValue: Buffer,
): { value: Buffer; key: Buffer } {
  const [validation, keySalt] = seeds.map((seed) => Buffer.alloc(8, seed)) as [Buffer, Buffer];
  const value = Buffer.concat([hash(password, validation, userValue), validation, keySalt]);
  const key = aesCbc(hash(password, keySalt, userValue), Buffer.alloc(16), fileKey, false);
  return { value, key };
}

function aes256(spec: TestEncryption): Encrypted {
  const isR6 = spec.cipher === "aes-256-r6";
  const hash = (password: string, salt: Buffer, userKey: Buffer): Buffer => {
    const bytes = Buffer.from(password, "utf8");
    return isR6
      ? hashR6(bytes, salt, userKey)
      : createHash("sha256")
          .update(Buffer.concat([bytes, salt, userKey]))
          .digest();
  };
  const fileKey = Buffer.alloc(32, 0x5a);
  const user = aes256Password(hash, spec.userPassword ?? "", [1, 2], fileKey, Buffer.alloc(0));
  const owner = aes256Password(hash, spec.ownerPassword ?? "", [3, 4], fileKey, user.value);
  const [userValue, userKey, ownerValue, ownerKey] = [user.value, user.key, owner.value, owner.key];
  const permsPlain = Buffer.concat([
    int32Le(PERMISSIONS),
    Buffer.from([0xff, 0xff, 0xff, 0xff]),
    Buffer.from("Tadb"),
    Buffer.alloc(4, 9),
  ]);
  const permsCipher = createCipheriv("aes-256-ecb", fileKey, null);
  permsCipher.setAutoPadding(false);
  const perms = Buffer.concat([permsCipher.update(permsPlain), permsCipher.final()]);
  return {
    dictionary: `<< /Filter /Standard /V 5 /R ${isR6 ? 6 : 5} /Length 256 /CF << /StdCF << /AuthEvent /DocOpen /CFM /AESV3 /Length 32 >> >> /StmF /StdCF /StrF /StdCF /O ${hex(ownerValue)} /U ${hex(userValue)} /OE ${hex(ownerKey)} /UE ${hex(userKey)} /P ${PERMISSIONS} /Perms ${hex(perms)} >>`,
    encryptStream(_num, _gen, data) {
      const iv = Buffer.alloc(16, 3);
      return Buffer.concat([iv, aesCbc(fileKey, iv, data, true)]);
    },
  };
}

/**
 * The encryption dictionary and stream encryptor for `spec`, keyed to the file identifier `id0`.
 *
 * @example
 * const encrypted = encryptionFor({ cipher: "aes-256-r6", ownerPassword: "owner" }, id0);
 */
export function encryptionFor(spec: TestEncryption, id0: Buffer): Encrypted {
  return spec.cipher.startsWith("aes-256") ? aes256(spec) : legacy(spec, id0);
}
