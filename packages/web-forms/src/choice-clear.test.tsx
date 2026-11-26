// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ChoiceSegments } from "./choice-segments";
import { buttonNamed, mount, press, type Mounted } from "./dom.test-utils";
import { markupOf, noop, tagsWith } from "./markup.test-utils";

/* A Yes / No / Depends answer that can go back to unanswered (D-190 §5): the choice's Clear. */

const YES_NO_DEPENDS = [
  { value: "required", label: "Yes" },
  { value: "not_required", label: "No" },
  { value: "depends", label: "Depends" },
];

const choice = (value: string, help?: string) =>
  markupOf(
    <ChoiceSegments
      name="buyout"
      legend="Do weddings need a full buyout?"
      options={YES_NO_DEPENDS}
      value={value}
      onChange={noop}
      look="soft"
      clearLabel="Clear"
      help={help}
    />,
  );

/** The answer held in state, as a form holds it. */
function Buyout() {
  const [value, setValue] = useState("depends");
  return (
    <>
      <ChoiceSegments
        name="buyout"
        legend="Do weddings need a full buyout?"
        options={YES_NO_DEPENDS}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        look="soft"
        clearLabel="Clear"
      />
      <output id="answer">{value === "" ? "unanswered" : value}</output>
    </>
  );
}

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("a choice that can be cleared", () => {
  it("offers Clear once answered, described by the question it clears", () => {
    const html = choice("depends");
    const [clear] = tagsWith(html, "button", 'type="button"');
    expect(clear).toContain('aria-describedby="buyout-legend"');
    expect(html).toContain('<legend id="buyout-legend"');
    expect(html).toContain(">Clear<");
  });

  it("offers no Clear while unanswered, and shows its help under the pills", () => {
    const html = choice("", "Choose Depends if it changes with the season.");
    expect(tagsWith(html, "button", 'type="button"')).toHaveLength(0);
    expect(html).toContain('<p id="buyout-help"');
    expect(tagsWith(html, "input", 'value="required"')[0]).toContain(
      'aria-describedby="buyout-help"',
    );
  });

  it("goes back to unanswered, with focus on the first answer so a keyboard can choose again", async () => {
    mounted = await mount(<Buyout />);
    await press(buttonNamed(mounted.host, "Clear"));
    expect(mounted.host.querySelector("#answer")?.textContent).toBe("unanswered");
    const first = mounted.host.querySelector('input[value="required"]');
    expect(document.activeElement).toBe(first);
    expect([...mounted.host.querySelectorAll("input:checked")]).toHaveLength(0);
  });
});
