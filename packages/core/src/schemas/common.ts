import { z } from "zod";

/** Shared pieces every schema reuses (data.md: UUID v7 ids, ISO timestamps in UTC, cursor pagination). */
export const uuid = z.uuid();
export const isoDateTime = z.iso.datetime();

export const cursorQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorQuery = z.infer<typeof cursorQuery>;

export function page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
