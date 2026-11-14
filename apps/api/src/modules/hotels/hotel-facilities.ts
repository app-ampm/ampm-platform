import { Prisma } from "../../generated/prisma/client.js";

/**
 * Convert a string-array (or null/undefined) into the value a nullable Prisma JSON column accepts: a JSON
 * value for a list, `Prisma.DbNull` for SQL NULL, and `undefined` to leave the column untouched on a patch.
 * Shared by the hotel, room and venue writes, which all persist their amenity lists to a `facilities_json`
 * column.
 */
export function facilitiesInput(
  value: string[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value;
}
