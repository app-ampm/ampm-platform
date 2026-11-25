import { describe, expect, it } from "vitest";

import { CodeField } from "./code-field";
import { CODE_LENGTH, codeDigits, codeInputHandler } from "./code-field.value";
import { markupOf, noop, tagsWith } from "./markup.test-utils";

/* The one-time code field: one real input for six digits (D-189 §8, HF-03). */

describe("code digits", () => {
  it("keeps the digits of what was typed, pasted or filled in, six at most", () => {
    expect(codeDigits("48 29 17")).toBe("482917");
    expect(codeDigits("Your code is 482917.")).toBe("482917");
    expect(codeDigits("4829170")).toBe("482917");
    expect(codeDigits("abc")).toBe("");
    expect(codeDigits("1234", 4)).toBe("1234");
    expect(CODE_LENGTH).toBe(6);
  });
});

describe("code field", () => {
  it("asks for the code with the number keypad and the platform's code autofill", () => {
    const html = markupOf(
      <CodeField id="code" label="Your 6-digit code" value="4829" onChange={noop} required />,
    );
    expect(html).toMatch(/<label for="code"[^>]*>Your 6-digit code<\/label>/);
    const [input] = tagsWith(html, "input", 'id="code"');
    expect(input).toContain('type="text"');
    expect(input).toContain('inputMode="numeric"');
    expect(input).toContain('autoComplete="one-time-code"');
    expect(input).toContain('spellCheck="false"');
    expect(input).toContain('aria-required="true"');
    expect(input).toContain('value="4829"');
    // A paste of "482 917" must reach the field whole, so the browser never cuts it short.
    expect(input).not.toContain("maxLength");
    expect(html).toContain("tabular-nums");
  });

  it("hands on digits only, at most six, however the text arrived", () => {
    const seen: string[] = [];
    const onInput = codeInputHandler((code) => seen.push(code));
    onInput({ target: { value: "482 917" } });
    onInput({ target: { value: "48291755" } });
    onInput({ target: { value: "4a8" } });
    expect(seen).toEqual(["482917", "482917", "48"]);
  });

  it("keeps the digits and points the field at its error", () => {
    const html = markupOf(
      <CodeField
        id="code"
        label="Code"
        value="111111"
        onChange={noop}
        error="That code didn't work"
      />,
    );
    const [input] = tagsWith(html, "input", 'id="code"');
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain('aria-describedby="code-error"');
    expect(input).toContain('value="111111"');
    expect(html).toContain("border-brand");
  });
});
