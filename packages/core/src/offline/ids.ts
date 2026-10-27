/**
 * A client-generated UUID v7 for offline-created records (data.md: UUID v7 ids). A 48-bit Unix-ms
 * timestamp in the leading bytes keeps ids roughly sortable by creation time; the rest is random.
 *
 * SPIKE-GRADE randomness: the default `random` is `Math.random`, enough to keep one device's
 * offline-created ids distinct, which is all the sprint 2 spike needs. Production swaps in a
 * crypto-backed source. Pure (no I/O), so the app and the Vitest suite share one definition.
 */
export function uuidv7(now: number = Date.now(), random: () => number = Math.random): string {
  const bytes = new Uint8Array(16);
  let timestamp = BigInt(Math.max(0, Math.floor(now)));
  for (let index = 5; index >= 0; index--) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  for (let index = 6; index < 16; index++) {
    bytes[index] = Math.floor(random() * 256) & 0xff;
  }
  bytes[6] = 0x70 | (bytes[6]! & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8]! & 0x3f); // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
