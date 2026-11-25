import { describe, expect, it } from "vitest";

import { CheckboxField } from "./checkbox-field";
import { ChoiceSegments } from "./choice-segments";
import { markupOf, noop, tagsWith } from "./markup.test-utils";
import { SelectField } from "./select-field";

/* The fields that choose (peacock-night.md §6): pill choices, the checkbox and the select. */

describe("pill choices", () => {
  const options = [
    { value: "whatsapp", label: "WhatsApp" },
    { value: "phone", label: "Call" },
  ];

  it("are native radios in a fieldset named by its legend, the chosen one checked", () => {
    const html = markupOf(
      <ChoiceSegments
        name="reach"
        legend="Best way to reach you"
        options={options}
        value="phone"
        onChange={noop}
        look="soft"
      />,
    );
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Best way to reach you<\/legend>/);
    expect(tagsWith(html, "input", 'name="reach"')).toHaveLength(2);
    expect(tagsWith(html, "input", 'type="radio"')).toHaveLength(2);
    expect(tagsWith(html, "input", 'value="phone"')[0]).toContain('checked=""');
    expect(tagsWith(html, "input", 'value="whatsapp"')[0]).not.toContain('checked=""');
    // The soft look: peacock glass behind the chosen word, not the switch's solid peacock.
    expect(html).toContain("bg-highlight/30");
  });

  it("start with nothing chosen and keep the legend for screen readers when hidden", () => {
    const html = markupOf(
      <ChoiceSegments
        name="type"
        legend="Type of request"
        isLegendHidden
        options={options}
        value=""
        onChange={noop}
      />,
    );
    expect(html).not.toContain('checked=""');
    expect(html).toContain('<legend class="sr-only">Type of request</legend>');
  });

  it("show an error in gold and point the radios at it", () => {
    const html = markupOf(
      <ChoiceSegments
        name="reach"
        legend="Reach"
        options={options}
        value=""
        onChange={noop}
        error="Pick one"
      />,
    );
    expect(html).toContain('<p id="reach-error" role="alert"');
    expect(html).toContain('aria-describedby="reach-error"');
  });
});

describe("checkbox", () => {
  it("keeps a native checkbox and draws the peacock box with a midnight tick when checked", () => {
    const html = markupOf(
      <CheckboxField id="consent" label="Send me news" checked onChange={noop} />,
    );
    expect(tagsWith(html, "input", 'type="checkbox"')[0]).toContain('checked=""');
    expect(html).toContain("bg-highlight");
    expect(html).toContain("✓");
  });

  it("draws an empty box when not checked", () => {
    const html = markupOf(
      <CheckboxField id="consent" label="Send me news" checked={false} onChange={noop} />,
    );
    expect(html).not.toContain("✓");
    expect(html).toContain("border-primary/34");
    expect(html).not.toContain('role="alert"');
  });

  it("announces a required tick that is missing, ringing the box in gold", () => {
    const html = markupOf(
      <CheckboxField
        id="notice"
        label="I have read the privacy notice"
        checked={false}
        onChange={noop}
        required
        error="Tick to accept the notice"
      />,
    );
    const [input] = tagsWith(html, "input", 'id="notice"');
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain('aria-describedby="notice-error"');
    expect(input).toContain('aria-required="true"');
    expect(html).toContain('<p id="notice-error" role="alert"');
    expect(html).toContain("border-brand");
  });
});

describe("select", () => {
  const designations = [
    { value: "General Manager", label: "General Manager" },
    { value: "Other", label: "Other" },
  ];

  it("is a labelled native select in the field's pill, with a placeholder to start from", () => {
    const html = markupOf(
      <SelectField
        id="designation"
        label="Designation"
        options={designations}
        placeholder="Choose one"
        value=""
        onChange={noop}
        required
      />,
    );
    expect(html).toMatch(/<label for="designation"[^>]*>Designation<\/label>/);
    const [select] = tagsWith(html, "select", 'id="designation"');
    expect(select).toContain('aria-required="true"');
    // The placeholder shows, in pearl 58%, while nothing is chosen.
    expect(html).toMatch(/<option value="" disabled="" selected="">Choose one<\/option>/);
    expect(select).toContain("text-muted");
    expect(tagsWith(html, "option", 'value="Other"')).toHaveLength(1);
    expect(html).toContain("rounded-full");
    // The chevron is drawn for sight only.
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>▾<\/span>/);
  });

  it("selects the chosen option and wires its error", () => {
    const html = markupOf(
      <SelectField
        id="designation"
        label="Designation"
        options={designations}
        value="Other"
        onChange={noop}
        error="Choose your designation"
      />,
    );
    expect(tagsWith(html, "option", 'value="Other"')[0]).toContain('selected=""');
    expect(tagsWith(html, "select", 'id="designation"')[0]).toContain(
      'aria-describedby="designation-error"',
    );
    expect(html).toContain("border-brand");
    expect(html).not.toContain('value=""');
  });
});
