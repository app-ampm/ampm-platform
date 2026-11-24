/*
 * RC4, written out because OpenSSL 3 (Node's crypto) no longer offers it by default, and the PDF standard
 * security handler still uses it for revisions 2 to 4 (40 to 128-bit keys; ISO 32000-1 §7.6.2). Used only
 * to open PDFs with the empty user password; never to protect anything.
 */

/** RC4 of `data` under `key` (1 to 256 bytes); encrypting and decrypting are the same operation. */
export function rc4(key: Uint8Array, data: Uint8Array): Buffer {
  const state = new Uint8Array(256);
  for (let index = 0; index < 256; index += 1) state[index] = index;
  let j = 0;
  for (let index = 0; index < 256; index += 1) {
    const value = state[index] ?? 0;
    j = (j + value + (key[index % key.length] ?? 0)) & 0xff;
    state[index] = state[j] ?? 0;
    state[j] = value;
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xff;
    const a = state[i] ?? 0;
    j = (j + a) & 0xff;
    const b = state[j] ?? 0;
    state[i] = b;
    state[j] = a;
    out[index] = (data[index] ?? 0) ^ (state[(a + b) & 0xff] ?? 0);
  }
  return out;
}
