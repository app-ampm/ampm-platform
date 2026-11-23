import { Prisma } from "../../generated/prisma/client.js";

/*
 * The hotel tables keep string lists in nullable JSON columns: amenities (`facilities_json` on hotels,
 * rooms and venues), and a hotel's name variants and cuisines (`name_aliases_json`, `cuisines_json`;
 * D-178). Prisma takes no plain null on a JSON column and reads one back as an untyped JSON value, so
 * every write and read of those columns goes through these two.
 */

/**
 * A string list (or null/undefined) as the value a nullable Prisma JSON column accepts: the list as JSON,
 * `Prisma.DbNull` for SQL NULL, and undefined to leave the column untouched on a patch.
 *
 * @example
 * data: { ...patch, cuisines: stringListInput(patch.cuisines) }
 */
export function stringListInput(
  value: readonly string[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value;
}

/**
 * A JSON list column read back as strings, narrowed without a cast: null unless it holds an array, and
 * any entry that is not a string dropped.
 *
 * @example
 * toStringList(row.nameAliases); // ["Synthetic Lake Hotel Annexe"]
 */
export function toStringList(value: Prisma.JsonValue | null): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}
