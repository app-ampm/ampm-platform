import { describe, expect, it } from "vitest";

import { CheckboxField } from "./checkbox-field";
import { ChipGroupField } from "./chip-group-field";
import { ChoiceSegments } from "./choice-segments";
import { markupOf, noop, tagsWith } from "./markup.test-utils";
import { NumberUnitField } from "./number-unit-field";
import { ReadOnlyFields } from "./read-only";
import { RepeatableFieldsets } from "./repeatable-fieldsets";
import { SelectField } from "./select-field";
import { TextAreaField } from "./text-area-field";
import { TextField } from "./text-field";

/*
 * Fields that can no longer change but can still be read and copied (D-190 §5, review fix E7): a form
 * submitted while a section was open keeps the person's unsaved text on screen to copy into a correction,
 * which a disabled fieldset would not let them select.
 */

const UNITS = [
  { value: "sqft", label: "sq ft" },
  { value: "sqm", label: "m²" },
];

function questions() {
  return (
    <>
      <TextField id="name" label="Hotel name" value="Synthetic Palace" onChange={noop} />
      <TextAreaField id="notes" label="Notes" value="Covered lawn" onChange={noop} />
      <NumberUnitField
        id="size"
        label="Size"
        value="450"
        onChange={noop}
        unit="sqft"
        units={UNITS}
        onUnitChange={noop}
        unitLabel="Unit of the size"
      />
      <SelectField id="state" label="State" options={[]} value="" onChange={noop} />
      <ChoiceSegments
        name="buyout"
        legend="Buyout"
        options={[{ value: "required", label: "Yes" }]}
        value="required"
        onChange={noop}
        clearLabel="Clear"
      />
      <CheckboxField id="noChanges" label="No changes" checked={false} onChange={noop} />
      <ChipGroupField
        id="facilities"
        legend="Facilities"
        options={[{ value: "Spa", label: "Spa" }]}
        value={["Spa"]}
        onChange={noop}
      />
      <RepeatableFieldsets
        id="rooms"
        legend="Room categories"
        rows={[{ key: "r1", legend: "Deluxe" }]}
        renderRow={() => null}
        onAdd={noop}
        onRemove={noop}
        addLabel="Add a room category"
        removeText="Remove"
        removeLabel={(name) => `Remove ${name}`}
        removedText={(name) => `${name} removed`}
        max={60}
        capText="That is the most this form takes."
      />
    </>
  );
}

describe("read-only fields", () => {
  it("keep text fields focusable and selectable, read-only rather than disabled", () => {
    const html = markupOf(<ReadOnlyFields isReadOnly>{questions()}</ReadOnlyFields>);
    expect(html).not.toContain("<fieldset disabled");
    for (const id of ["name", "size"]) {
      const [input] = tagsWith(html, "input", `id="${id}"`);
      expect(input).toContain('readOnly=""');
      expect(input).not.toContain("disabled");
    }
    const [textarea] = tagsWith(html, "textarea", 'id="notes"');
    expect(textarea).toContain('readOnly=""');
    expect(textarea).not.toContain("disabled");
  });

  it("let no choice, tick, chip or row change, and offer no Clear, Add or Remove", () => {
    const html = markupOf(<ReadOnlyFields isReadOnly>{questions()}</ReadOnlyFields>);
    expect(tagsWith(html, "select", 'id="size-unit"')[0]).toContain('disabled=""');
    expect(tagsWith(html, "select", 'id="state"')[0]).toContain('disabled=""');
    expect(tagsWith(html, "input", 'type="radio"')[0]).toContain('disabled=""');
    expect(tagsWith(html, "input", 'id="noChanges"')[0]).toContain('disabled=""');
    expect(tagsWith(html, "button", "aria-pressed")[0]).toContain('disabled=""');
    for (const action of [">Clear<", ">Add a room category<", ">Remove<"])
      expect(html).not.toContain(action);
  });

  it("change nothing outside, or while the form can still change", () => {
    const html = markupOf(<ReadOnlyFields isReadOnly={false}>{questions()}</ReadOnlyFields>);
    expect(html).not.toContain('readOnly=""');
    expect(html).not.toContain('disabled=""');
    expect(markupOf(questions())).toBe(html);
  });
});
