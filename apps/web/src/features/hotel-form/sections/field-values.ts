import type {
  HotelFormArea,
  HotelFormAreaUnit,
  HotelFormCapacity,
  HotelFormSectionKey,
} from "@ampm/core";
import type { z } from "zod";

/*
 * What a section's fields hold while the person types, and how each is read into the section's draft
 * (D-190 §2 and §5). A field holds text as typed, so "12." or a half-typed email stays on screen; it is
 * read through its own schema from core, and a refused one is sent as it was saved, with its message on
 * the field, so one field being typed never holds back the rest of the section. Numbers are never NaN:
 * what does not read as a number is left as text, which the schema refuses with its own words.
 */

/** A copy of an object whose fields can be set one by one. */
export type Writable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * The fields with one changed.
 *
 * @example
 * withField(fields, "city", "Udaipur");
 */
export function withField<F extends object, K extends keyof F>(fields: F, key: K, value: F[K]): F {
  const next: Writable<F> = { ...fields };
  next[key] = value;
  return next;
}

/** A field's id on the page, from its section and its place in it. */
export function fieldId(section: HotelFormSectionKey, ...parts: readonly string[]): string {
  return ["hf", section, ...parts].join("-");
}

/** Reads fields through their schemas, keeping each refused one's message by the field's id. */
export interface AnswerReader {
  /** Each refused field's message, by its id. */
  readonly errors: Readonly<Record<string, string>>;
  /** The field's answer as typed when its schema reads it, else `saved`, its message kept. */
  readonly read: <T>(id: string, schema: z.ZodType<T>, input: unknown, saved: T) => T;
  /** Keeps a message for a field the section checks itself. */
  readonly refuse: (id: string, message: string) => void;
}

/**
 * A reader for one pass over a section's fields.
 *
 * @example
 * const reader = answerReader();
 * const city = reader.read(fieldId("property", "city"), SHAPE.city, fields.city, saved.city);
 */
export function answerReader(): AnswerReader {
  const errors: Record<string, string> = {};
  return {
    errors,
    read: (id, schema, input, saved) => {
      const parsed = schema.safeParse(input);
      if (parsed.success) return parsed.data;
      errors[id] = parsed.error.issues[0]?.message ?? "";
      return saved;
    },
    refuse: (id, message) => {
      errors[id] = message;
    },
  };
}

/**
 * Whether nothing is typed in a row: every text it holds is blank (its units and keys aside). A blank row
 * is not sent, so a row the page starts with, or one added and left empty, saves nothing.
 *
 * @example
 * isBlankRow([row.name, row.roomCount, row.notes]); // true while none is typed
 */
export function isBlankRow(texts: readonly string[]): boolean {
  return texts.every((text) => text.trim() === "");
}

/** Text as a field shows it: no answer is blank. */
export const textOf = (value: string | null | undefined): string => value ?? "";

/** A choice's value: "" while unanswered. */
export const choiceInput = (value: string): string | null => (value === "" ? null : value);

/**
 * A number as typed, for its schema: blank is no answer, spaces and commas are dropped ("1,20,000"), and
 * anything else is left as typed for the schema to refuse ("Enter a number").
 *
 * @example
 * numberInput("1,200"); // 1200
 * numberInput("12a"); // "12a"
 */
export function numberInput(text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const digits = trimmed.replace(/[\s,]/g, "");
  return /^-?\d+(?:\.\d+)?$/.test(digits) ? Number(digits) : trimmed;
}

/** A saved number as a field shows it. */
export const numberText = (value: number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/** An area as its field holds it: the number as typed and its unit. */
export interface AreaText {
  readonly value: string;
  readonly unit: HotelFormAreaUnit;
}

/** A new area field's unit: Indian fact sheets mostly give sq ft. */
export const DEFAULT_AREA_UNIT: HotelFormAreaUnit = "sqft";

/** A saved area as its field shows it. */
export function areaText(area: HotelFormArea | null | undefined): AreaText {
  return area
    ? { value: String(area.value), unit: area.unit }
    : { value: "", unit: DEFAULT_AREA_UNIT };
}

/** An area for its schema: no number is no answer, whatever the unit. */
export function areaInput(area: AreaText): unknown {
  const value = numberInput(area.value);
  return value === null ? null : { unit: area.unit, value };
}

const RANGE = /^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i;

/**
 * A capacity as its field shows it: a number of guests, or a range with an en dash.
 *
 * @example
 * capacityText({ min: 250, max: 300 }); // "250–300"
 */
export function capacityText(capacity: HotelFormCapacity | null | undefined): string {
  if (capacity === null || capacity === undefined) return "";
  return typeof capacity === "number" ? String(capacity) : `${capacity.min}–${capacity.max}`;
}

/**
 * A capacity as typed, for its schema: "250", or a range ("250-300", "250–300", "250 to 300").
 *
 * @example
 * capacityInput("250 to 300"); // { min: 250, max: 300 }
 */
export function capacityInput(text: string): unknown {
  const compact = text.trim().replace(/,/g, "");
  if (compact === "") return null;
  if (/^\d+$/.test(compact)) return Number(compact);
  const range = RANGE.exec(compact);
  return range ? { min: Number(range[1]), max: Number(range[2]) } : compact;
}

/** A Yes or No question's value: "" while unanswered. */
export type YesNo = "" | "yes" | "no";

/** A saved Yes or No as its choice shows it. */
export function yesNoOf(value: boolean | null | undefined): YesNo {
  if (value === true) return "yes";
  return value === false ? "no" : "";
}

/** A Yes or No choice as its answer: null while unanswered. */
export function booleanOf(choice: string): boolean | null {
  if (choice === "yes") return true;
  return choice === "no" ? false : null;
}
