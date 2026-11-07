import { useState } from "react";

import { byRole, pressKey, renderOnWeb } from "../../test/web";
import { Checkbox } from "./checkbox";

function Harness({ disabled = false }: { readonly disabled?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="I've read the privacy notice"
      checked={checked}
      onCheckedChange={setChecked}
      disabled={disabled}
    />
  );
}

// The browser's side of the checkbox: the state as aria-checked (react-native-web drops
// accessibilityState) and Space, which react-native-web only handles for buttons.
describe("Checkbox on the web", () => {
  it("is a named checkbox whose state reaches the browser", async () => {
    const { container } = await renderOnWeb(<Harness />);
    const box = byRole(container, "checkbox");
    expect(box.getAttribute("aria-label")).toBe("I've read the privacy notice");
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("ticks with Space, without scrolling the page", async () => {
    const { container } = await renderOnWeb(<Harness />);
    const box = byRole(container, "checkbox");
    const space = await pressKey(box, " ");
    expect(space.defaultPrevented).toBe(true);
    expect(box.getAttribute("aria-checked")).toBe("true");
    await pressKey(box, " ");
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("says it is disabled and ignores Space", async () => {
    const { container } = await renderOnWeb(<Harness disabled />);
    const box = byRole(container, "checkbox");
    expect(box.getAttribute("aria-disabled")).toBe("true");
    await pressKey(box, " ");
    expect(box.getAttribute("aria-checked")).toBe("false");
  });
});
