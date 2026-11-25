import { describe, expect, it } from "vitest";

import { FieldMessage, fieldAria } from "./field-message";
import { FieldShell } from "./field-shell";
import { markupOf, noop, tagsWith } from "./markup.test-utils";
import { MobileField } from "./mobile-field";
import { TextAreaField } from "./text-area-field";
import { TextField } from "./text-field";

/* The text fields (peacock-night.md §6, Input) as the server sends them: the label, the pill and the line under it. */

describe("field aria", () => {
  it("marks an invalid control and points it at its error", () => {
    expect(fieldAria("email", { error: "Enter an email", help: "Optional" })).toEqual({
      "aria-invalid": true,
      "aria-describedby": "email-error",
      "aria-required": undefined,
    });
  });

  it("points a valid control at its help and announces it as required", () => {
    expect(fieldAria("name", { help: "As on your card", required: true })).toEqual({
      "aria-invalid": undefined,
      "aria-describedby": "name-help",
      "aria-required": true,
    });
    expect(fieldAria("name", {})).toEqual({
      "aria-invalid": undefined,
      "aria-describedby": undefined,
      "aria-required": undefined,
    });
  });
});

describe("field message", () => {
  it("announces an error in gold, named after its control", () => {
    const html = markupOf(<FieldMessage id="email" error="Enter an email" help="Optional" />);
    expect(html).toMatch(/^<p id="email-error" role="alert" class="[^"]*text-brand[^"]*">/);
    expect(html).not.toContain("Optional");
  });

  it("shows the help quietly, and nothing without either", () => {
    expect(markupOf(<FieldMessage id="email" help="Optional" />)).toMatch(
      /^<p id="email-help" class="[^"]*text-muted[^"]*">Optional<\/p>$/,
    );
    expect(markupOf(<FieldMessage id="email" />)).toBe("");
  });
});

describe("field shell", () => {
  it("labels the control by its id and adds the quiet optional word", () => {
    const html = markupOf(
      <FieldShell id="email" label="Email" optionalText="optional">
        <input id="email" />
      </FieldShell>,
    );
    expect(html).toMatch(
      /<label for="email" class="[^"]+">Email<span class="[^"]+"> · optional<\/span><\/label>/,
    );
  });
});

describe("text field", () => {
  it("is a labelled pill input that passes the input's own attributes through", () => {
    const html = markupOf(
      <TextField
        id="name"
        label="Full name"
        value="Asha"
        onChange={noop}
        required
        autoComplete="name"
      />,
    );
    const [input] = tagsWith(html, "input", 'id="name"');
    expect(input).toContain('aria-required="true"');
    expect(input).toContain('autoComplete="name"');
    expect(input).toContain('value="Asha"');
    expect(html).toContain("rounded-full");
  });

  it("turns the pill gold and keeps the value when the field has an error", () => {
    const html = markupOf(
      <TextField id="name" label="Full name" value="A" onChange={noop} error="Too short" />,
    );
    expect(html).toContain("border-brand");
    expect(tagsWith(html, "input", 'id="name"')[0]).toContain('aria-describedby="name-error"');
    expect(html).toContain('value="A"');
  });

  it("draws a fixed prefix for sight only", () => {
    const html = markupOf(
      <TextField id="phone" label="Mobile" value="" onChange={noop} prefixText="+91" />,
    );
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]+"><span class="[^"]+">\+91<\/span>/);
  });
});

describe("mobile field", () => {
  it("asks for an Indian mobile after a fixed +91, with the phone keypad and autofill", () => {
    const html = markupOf(
      <MobileField id="mobile" label="Mobile number" value="98765" onChange={noop} required />,
    );
    const [input] = tagsWith(html, "input", 'id="mobile"');
    expect(input).toContain('type="tel"');
    expect(input).toContain('inputMode="tel"');
    expect(input).toContain('autoComplete="tel-national"');
    expect(input).toContain('aria-required="true"');
    expect(html).toMatch(/aria-hidden="true"[^>]*><span[^>]*>\+91<\/span>/);
  });
});

describe("text area field", () => {
  it("is a labelled multi-line field at radius 22 with its rows", () => {
    const html = markupOf(
      <TextAreaField
        id="notes"
        label="Notes"
        value="Hi"
        onChange={noop}
        rows={3}
        help="Optional"
      />,
    );
    expect(html).toMatch(/<label for="notes"[^>]*>Notes<\/label>/);
    expect(html).toMatch(/<textarea id="notes"[^>]*aria-describedby="notes-help"[^>]*rows="3"/);
    expect(html).toContain("rounded-lg");
    expect(html).toContain(">Hi</textarea>");
  });
});
