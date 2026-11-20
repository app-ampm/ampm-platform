import { argon2, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Staff password hashing (D-142): Argon2id from Node's own crypto, OWASP's first-choice parameters
 * (19 MiB, 2 passes, 1 lane), stored in the PHC string format so parameters can be raised later and
 * old hashes still verify. A hash is SECRET and never leaves the API.
 *
 * @example
 * const stored = await hashPassword("correct horse battery staple");
 * await verifyPassword("correct horse battery staple", stored); // true
 */
const PARAMS = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 } as const;
const SALT_BYTES = 16;
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

interface Argon2Params {
  readonly memory: number;
  readonly passes: number;
  readonly parallelism: number;
  readonly tagLength: number;
}

function derive(password: string, salt: Buffer, params: Argon2Params): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2("argon2id", { message: password, nonce: salt, ...params }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

const b64 = (bytes: Buffer): string => bytes.toString("base64").replace(/=+$/, "");

/** Hashes a password into a PHC string: `$argon2id$v=19$m=…,t=…,p=…$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, PARAMS);
  return `$argon2id$v=19$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${b64(salt)}$${b64(hash)}`;
}

/** Whether `password` matches a stored PHC string; a malformed string never matches. Constant-time. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const match = PHC.exec(stored);
  if (!match) return false;
  const [, memory, passes, parallelism, salt, hash] = match;
  const expected = Buffer.from(hash ?? "", "base64");
  const actual = await derive(password, Buffer.from(salt ?? "", "base64"), {
    memory: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
    tagLength: expected.length,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;

/**
 * Spends the same work as a real check when there is no account (or no password) to check against,
 * so the response time does not reveal which emails have accounts. Always resolves false.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummy ??= hashPassword(randomBytes(32).toString("base64"));
  await verifyPassword(password, await dummy);
  return false;
}
