/**
 * A table entry by its document text; own keys only, so a text such as "constructor" is unknown
 * rather than an inherited property. The parsers look every note, prefix, qualifier and status set
 * up through this, and stop on undefined.
 *
 * @example
 * lookup(STAFF_NOTES, "hotel lines"); // [{ kind: "side", anyOf: ["hotel"] }]
 */
export function lookup<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
