import type { VenueOtherLayout } from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";

/*
 * A venue's other layouts (D-178) live in the nullable JSON column `other_layouts_json`. Prisma takes no
 * plain null on a JSON column and reads one back as an untyped JSON value, so every write and read of it
 * goes through these two, as the string lists go through hotel-string-lists.ts.
 */

/**
 * The layouts as the column takes them: each entry with its keys in one order and no undefined minimum,
 * `Prisma.DbNull` for SQL NULL, and undefined to leave the column untouched on a patch.
 *
 * @example
 * data: { ...patch, otherLayouts: venueLayoutsInput(patch.otherLayouts) }
 */
export function venueLayoutsInput(
  value: readonly VenueOtherLayout[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value.map(({ layout, max, min }) =>
    min === undefined ? { layout, max } : { layout, max, min },
  );
}

const isRecord = (value: Prisma.JsonValue): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One stored entry, narrowed without a cast; null when it is not a layout. */
function layoutOf(value: Prisma.JsonValue): VenueOtherLayout | null {
  if (!isRecord(value)) return null;
  const { layout, max, min } = value;
  if (typeof layout !== "string" || typeof max !== "number") return null;
  if (typeof min === "number") return { layout, max, min };
  return min === undefined || min === null ? { layout, max } : null;
}

/**
 * The column read back as layouts: null unless it holds an array, and an entry that is not a layout
 * dropped.
 *
 * @example
 * toVenueLayouts(row.otherLayouts); // [{ layout: "Classroom", max: 120 }]
 */
export function toVenueLayouts(value: Prisma.JsonValue | null): VenueOtherLayout[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    const layout = layoutOf(entry);
    return layout === null ? [] : [layout];
  });
}
