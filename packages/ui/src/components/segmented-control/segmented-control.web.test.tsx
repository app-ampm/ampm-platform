import { useState } from "react";

import { allByRole, byRole, pressKey, renderOnWeb } from "../../test/web";
import { SegmentedControl, type SegmentedControlOption } from "./segmented-control";

const OPTIONS: readonly SegmentedControlOption[] = [
  { value: "waiting", label: "Waiting", badge: 4 },
  { value: "decided", label: "Decided", badge: 11 },
  { value: "archived", label: "Archived", disabled: true },
];

function Harness({ onChange }: { readonly onChange?: (value: string) => void }) {
  const [value, setValue] = useState("waiting");
  return (
    <SegmentedControl
      accessibilityLabel="Approvals"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

function tab(container: HTMLElement, index: number): HTMLElement {
  const found = allByRole(container, "tab")[index];
  if (!found) throw new Error(`no tab ${index}`);
  return found;
}

// Waiting / Decided and the hotel page tabs in the browser: the selection must arrive as
// aria-selected (react-native-web drops accessibilityState) and Space must select as Enter does.
describe("SegmentedControl on the web", () => {
  it("is a named tab list whose selected tab is aria-selected", async () => {
    const { container } = await renderOnWeb(<Harness />);
    expect(byRole(container, "tablist").getAttribute("aria-label")).toBe("Approvals");
    const tabs = allByRole(container, "tab");
    expect(tabs.map((each) => each.getAttribute("aria-label"))).toEqual([
      "Waiting, 4",
      "Decided, 11",
      "Archived",
    ]);
    expect(tabs.map((each) => each.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(tab(container, 2).getAttribute("aria-disabled")).toBe("true");
  });

  it("selects a segment with Space, without scrolling the page", async () => {
    const onChange = jest.fn();
    const { container } = await renderOnWeb(<Harness onChange={onChange} />);
    const space = await pressKey(tab(container, 1), " ");
    expect(space.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalledWith("decided");
    expect(tab(container, 1).getAttribute("aria-selected")).toBe("true");
    expect(tab(container, 0).getAttribute("aria-selected")).toBe("false");
  });

  it("ignores Space on a disabled segment", async () => {
    const onChange = jest.fn();
    const { container } = await renderOnWeb(<Harness onChange={onChange} />);
    await pressKey(tab(container, 2), " ");
    expect(onChange).not.toHaveBeenCalled();
  });
});
