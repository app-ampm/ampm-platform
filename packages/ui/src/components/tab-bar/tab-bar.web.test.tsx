import { useState } from "react";

import { allByRole, byRole, pressKey, renderOnWeb } from "../../test/web";
import { TabBar } from "./tab-bar";
import type { TabBarItem } from "./tab-bar-item";

const TABS: TabBarItem[] = [
  { key: "home", label: "Home" },
  { key: "hotels", label: "Hotels" },
  { key: "approvals", label: "Approvals", badge: 2 },
];

function Harness({ onSelect }: { readonly onSelect?: (key: string) => void }) {
  const [active, setActive] = useState("home");
  return (
    <TabBar
      items={TABS}
      activeKey={active}
      floating={false}
      onSelect={(key) => {
        onSelect?.(key);
        setActive(key);
      }}
    />
  );
}

// The client portal's navigation under 768 in the browser: the current tab must reach the browser as
// aria-selected (react-native-web drops accessibilityState) and Space must select as Enter does.
describe("TabBar on the web", () => {
  it("is a named tab list whose current tab is aria-selected", async () => {
    const { container } = await renderOnWeb(<Harness />);
    expect(byRole(container, "tablist").getAttribute("aria-label")).toBe("Main navigation");
    const tabs = allByRole(container, "tab");
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Home",
      "Hotels",
      "Approvals, 2 waiting",
    ]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("selects a tab with Space, without scrolling the page", async () => {
    const onSelect = jest.fn();
    const { container } = await renderOnWeb(<Harness onSelect={onSelect} />);
    const hotels = allByRole(container, "tab")[1];
    if (!hotels) throw new Error("no Hotels tab");
    const space = await pressKey(hotels, " ");
    expect(space.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledWith("hotels");
    expect(hotels.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps the drawn count away from screen readers: the tab's name says it", async () => {
    const { container } = await renderOnWeb(<Harness />);
    const approvals = allByRole(container, "tab")[2];
    expect(approvals?.querySelector('[aria-hidden="true"]')?.textContent).toBe("2");
  });
});
