import { describe, expect, it } from "vitest";

import {
  isWellFormedText,
  LONE_SURROGATE_MESSAGE,
  NUL_TEXT_MESSAGE,
  storableJsonText,
} from "./common";

/*
 * Text a JSON column keeps (D-190 §2): PostgreSQL's jsonb refuses the null character and half of a
 * surrogate pair, so the hotel form's drafts refuse both on their field instead of failing at the write.
 */
describe("isWellFormedText", () => {
  it("accepts any text whose surrogates come in pairs", () => {
    for (const text of ["", "Lake Palace", "महल", "Garden 😀 lawn", "😀"]) {
      expect(isWellFormedText(text), text).toBe(true);
    }
  });

  it("refuses a high surrogate without its low half, or a low one alone", () => {
    for (const text of ["\ud800", "a\ud83d", "\ude00b", "\ude00\ud83d", "x\ud83dy"]) {
      expect(isWellFormedText(text), JSON.stringify(text)).toBe(false);
    }
  });
});

describe("storableJsonText", () => {
  it("trims, and refuses the null character and a lone surrogate on the field", () => {
    expect(storableJsonText().max(20).parse("  Lake View  ")).toBe("Lake View");
    expect(storableJsonText().safeParse("Seated\u0000300").error?.issues[0]?.message).toBe(
      NUL_TEXT_MESSAGE,
    );
    expect(storableJsonText().safeParse("Lawn \ud83d").error?.issues[0]?.message).toBe(
      LONE_SURROGATE_MESSAGE,
    );
  });
});
