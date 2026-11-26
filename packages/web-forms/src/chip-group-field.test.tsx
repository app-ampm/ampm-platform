// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ChipGroupField, type ChipGroupFieldProps } from "./chip-group-field";
import { buttonNamed, mount, press, type Mounted } from "./dom.test-utils";
import { markupOf, noop, tagsWith } from "./markup.test-utils";

/* A chip group with Other (D-190 §5): facilities and cuisines, each chosen once, and Other's words. */

const OPTIONS = [
  { value: "Spa", label: "Spa" },
  { value: "Gym", label: "Gym" },
  { value: "Bar", label: "Bar" },
];

const other = (text = "", textError?: string): NonNullable<ChipGroupFieldProps["other"]> => ({
  value: "Other",
  label: "Other",
  textId: "facilities-other",
  textLabel: "Other facilities",
  text,
  onTextChange: noop,
  textError,
});

const group = (props: Partial<ChipGroupFieldProps> = {}) =>
  markupOf(
    <ChipGroupField
      id="facilities"
      legend="Facilities"
      options={OPTIONS}
      value={["Gym"]}
      onChange={noop}
      {...props}
    />,
  );

/** The group with its choice held in state, as a form holds it. */
function Facilities({ chosen = [] }: { readonly chosen?: readonly string[] }) {
  const [value, setValue] = useState<readonly string[]>(chosen);
  return (
    <>
      <ChipGroupField
        id="facilities"
        legend="Facilities"
        options={OPTIONS}
        value={value}
        onChange={setValue}
        other={other()}
      />
      <output id="chosen">{value.join(",")}</output>
    </>
  );
}

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("chip group, as the server sends it", () => {
  it("is a named group of toggle buttons, each saying whether it is chosen", () => {
    const html = group();
    expect(html).toMatch(/<fieldset id="facilities"[^>]*><legend[^>]*>Facilities<\/legend>/);
    expect(tagsWith(html, "button", 'aria-pressed="true"')).toHaveLength(1);
    expect(tagsWith(html, "button", 'aria-pressed="false"')).toHaveLength(2);
    expect(tagsWith(html, "button", 'type="button"')).toHaveLength(3);
    // The chosen chip is peacock with a midnight word; a 44px target holds each 38px pill.
    expect(html).toContain("bg-highlight");
    expect(html).toContain("py-1");
  });

  it("adds Other last, and asks for its words only once Other is chosen", () => {
    expect(group({ other: other() })).not.toContain('id="facilities-other"');
    const html = group({ value: ["Other"], other: other("Helipad") });
    expect(tagsWith(html, "button", 'aria-pressed="true"')).toHaveLength(1);
    expect(html.lastIndexOf(">Other<")).toBeGreaterThan(html.indexOf(">Bar<"));
    expect(tagsWith(html, "input", 'id="facilities-other"')[0]).toContain('value="Helipad"');
    expect(html).toMatch(/<label for="facilities-other"[^>]*>Other facilities<\/label>/);
  });

  it("shows a chosen value the list no longer has as a chip of its own, chosen, before Other", () => {
    const html = group({ value: ["Gym", "Helipad"], other: other() });
    expect(tagsWith(html, "button", 'aria-pressed="true"')).toHaveLength(2);
    expect(html).toContain(">Helipad<");
    expect(html.indexOf(">Helipad<")).toBeGreaterThan(html.indexOf(">Bar<"));
    expect(html.lastIndexOf(">Other<")).toBeGreaterThan(html.indexOf(">Helipad<"));
  });

  it("points every chip at the group's error, and Other's words at their own", () => {
    const html = group({
      error: "Give each cuisine once",
      value: ["Other"],
      other: other("x", "Too long"),
    });
    for (const chip of tagsWith(html, "button", "aria-pressed"))
      expect(chip).toContain('aria-describedby="facilities-error"');
    expect(html).toContain('<p id="facilities-error" role="alert"');
    expect(tagsWith(html, "input", 'id="facilities-other"')[0]).toContain(
      'aria-describedby="facilities-other-error"',
    );
  });
});

describe("chip group in use", () => {
  it("toggles a chip on and off, keeping the options' order whatever the order of presses", async () => {
    mounted = await mount(<Facilities />);
    await press(buttonNamed(mounted.host, "Bar"));
    await press(buttonNamed(mounted.host, "Spa"));
    expect(mounted.host.querySelector("#chosen")?.textContent).toBe("Spa,Bar");
    const spa = buttonNamed(mounted.host, "Spa");
    expect(spa.getAttribute("aria-pressed")).toBe("true");
    // Pressed from the keyboard: focus stays on the chip, which is kept, so a keyboard carries on there.
    spa.focus();
    await press(spa);
    expect(mounted.host.querySelector("#chosen")?.textContent).toBe("Bar");
    expect(spa.getAttribute("aria-pressed")).toBe("false");
    expect(document.activeElement).toBe(spa);
  });

  it("keeps a chosen value the list no longer has when another chip is pressed, until it is unticked", async () => {
    mounted = await mount(<Facilities chosen={["Helipad", "Gym"]} />);
    await press(buttonNamed(mounted.host, "Spa"));
    expect(mounted.host.querySelector("#chosen")?.textContent).toBe("Spa,Gym,Helipad");
    await press(buttonNamed(mounted.host, "Helipad"));
    expect(mounted.host.querySelector("#chosen")?.textContent).toBe("Spa,Gym");
    expect([...mounted.host.querySelectorAll("button")].map((chip) => chip.textContent)).toEqual([
      "Spa",
      "Gym",
      "Bar",
      "Other",
    ]);
  });

  it("puts Other after the listed chips", async () => {
    mounted = await mount(<Facilities />);
    await press(buttonNamed(mounted.host, "Other"));
    await press(buttonNamed(mounted.host, "Gym"));
    expect(mounted.host.querySelector("#chosen")?.textContent).toBe("Gym,Other");
  });
});
