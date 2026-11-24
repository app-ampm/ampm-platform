import { z } from "zod";

/** Shared pieces every schema reuses (data.md: UUID v7 ids, ISO timestamps in UTC, cursor pagination). */
export const uuid = z.uuid();
export const isoDateTime = z.iso.datetime();

/** Why text holding the null character is refused: PostgreSQL stores none in text, varchar or jsonb. */
export const NUL_TEXT_MESSAGE =
  "Remove the null character from this text (text copied from a PDF can carry one)";

const NUL = "\u0000";

/**
 * Text as a request writes it: trimmed, and refused on its own field when it holds the null character
 * (U+0000), which no PostgreSQL text, varchar or jsonb column stores, so the refusal is a 400 that names
 * the field rather than a database error. A field-level check: it survives `.partial()`. Chain the bounds
 * after it.
 *
 * @example
 * storableText().min(1).max(255).parse("  Lake View  "); // "Lake View"
 * storableText().safeParse("Seated 300\u0000").success; // false
 */
export function storableText() {
  return z
    .string()
    .trim()
    .refine((text) => !text.includes(NUL), NUL_TEXT_MESSAGE);
}

export const cursorQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorQuery = z.infer<typeof cursorQuery>;

export function page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}

/**
 * Money on the wire: integer minor units (paise) plus the currency, the same shape `money.ts` models.
 * One wire shape for every audience; the audience safety (a `ClientAmount` can never be built from an
 * `InternalAmount`) lives in `money.ts`, and a view emits a client amount through `clientAmount()`.
 */
export const money = z.object({
  minor: z.number().int(),
  currency: z.literal("INR"),
});
export type Money = z.infer<typeof money>;
