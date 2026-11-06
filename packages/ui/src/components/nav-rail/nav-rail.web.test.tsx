import { allByRole, renderOnWeb } from "../../test/web";
import { NavRail } from "./nav-rail";
import type { NavRailItem } from "./nav-rail-item";

const AREAS: NavRailItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "hotels", label: "Hotels", icon: "hotel", count: 200 },
  { key: "tasks", label: "Tasks & Operations", icon: "list-checks", badge: 3 },
];

const button = (container: HTMLElement, name: string) =>
  allByRole(container, "button").find((each) => each.getAttribute("aria-label") === name);

// The admin workspace in the browser (768 and up): react-native-web drops accessibilityState, so the
// current area is aria-current="page" and the collapse toggle says aria-expanded.
describe("NavRail on the web", () => {
  it("marks the current area as the current page", async () => {
    const { container } = await renderOnWeb(
      <NavRail items={AREAS} activeKey="hotels" onSelect={() => undefined} />,
    );
    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe("Workspace navigation");
    expect(button(container, "Hotels, 200")?.getAttribute("aria-current")).toBe("page");
    expect(button(container, "Home")?.hasAttribute("aria-current")).toBe(false);
    // The drawn badge (and the icon) are for the eye: the button's name says the count.
    const tasks = button(container, "Tasks & Operations, 3 waiting");
    const hidden = [...(tasks?.querySelectorAll('[aria-hidden="true"]') ?? [])];
    expect(hidden.map((part) => part.textContent)).toContain("3");
  });

  it("says whether the rail is expanded", async () => {
    const rail = (collapsed: boolean) => (
      <NavRail
        items={AREAS}
        activeKey="home"
        onSelect={() => undefined}
        collapsed={collapsed}
        onToggleCollapsed={() => undefined}
      />
    );
    const { container, rerender } = await renderOnWeb(rail(false));
    expect(button(container, "Collapse navigation")?.getAttribute("aria-expanded")).toBe("true");
    await rerender(rail(true));
    const expand = allByRole(container, "button").find((each) =>
      each.hasAttribute("aria-expanded"),
    );
    expect(expand?.getAttribute("aria-expanded")).toBe("false");
  });
});
