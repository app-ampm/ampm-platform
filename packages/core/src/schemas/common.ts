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

/** Why text holding half of a surrogate pair is refused: PostgreSQL's jsonb stores none. */
export const LONE_SURROGATE_MESSAGE =
  "Remove the broken character from this text (an emoji cut in half, often from copying)";

/**
 * Whether text holds every surrogate in a pair: a high one (U+D800 to U+DBFF) followed by a low one
 * (U+DC00 to U+DFFF), and no low one alone. jsonb refuses the escape of a lone surrogate, which
 * JSON.stringify writes for one, so such text fails at the write unless refused first.
 *
 * @example
 * isWellFormedText("Lawn 😀"); // true
 * isWellFormedText("Lawn \ud83d"); // false
 */
export function isWellFormedText(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    }
  }
  return true;
}

/**
 * Text a JSON column keeps: {@link storableText}, and refused on its own field when it holds a lone
 * surrogate (`isWellFormedText`), which jsonb stores no more than the null character. Chain the bounds
 * after it.
 *
 * @example
 * storableJsonText().max(255).parse(" Lake View "); // "Lake View"
 */
export function storableJsonText() {
  return storableText().refine(isWellFormedText, LONE_SURROGATE_MESSAGE);
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
