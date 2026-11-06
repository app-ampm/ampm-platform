import { useState } from "react";

import { byRole, pressKey, renderOnWeb } from "../../test/web";
import { Toggle } from "./toggle";

function Harness({ disabled = false }: { readonly disabled?: boolean }) {
  const [value, setValue] = useState(false);
  return (
    <Toggle
      label="Remember this device"
      value={value}
      onValueChange={setValue}
      disabled={disabled}
    />
  );
}

// The browser's side of the switch: react-native-web drops accessibilityState, so the state must
// arrive as aria-checked, and it renders the switch as a <div>, so Space must be handled by hand.
describe("Toggle on the web", () => {
  it("is a named switch whose on or off state reaches the browser", async () => {
    const { container } = await renderOnWeb(<Harness />);
    const toggle = byRole(container, "switch");
    expect(toggle.getAttribute("aria-label")).toBe("Remember this device");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("toggles with Space, without scrolling the page, and with Enter", async () => {
    const { container } = await renderOnWeb(<Harness />);
    const toggle = byRole(container, "switch");
    const space = await pressKey(toggle, " ");
    expect(space.defaultPrevented).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await pressKey(toggle, "Enter");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("says it is disabled and ignores the keyboard", async () => {
    const { container } = await renderOnWeb(<Harness disabled />);
    const toggle = byRole(container, "switch");
    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    await pressKey(toggle, " ");
    await pressKey(toggle, "Enter");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});
