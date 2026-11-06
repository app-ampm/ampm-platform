import { Text } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { NavRail } from "./nav-rail";
import type { NavRailItem } from "./nav-rail-item";
import { navRailItemStyles, navRailStyles } from "./nav-rail.styles";

const AREAS: NavRailItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "leads", label: "Leads & Clients", icon: "users", count: 24 },
  { key: "hotels", label: "Hotels", icon: "hotel", count: 200 },
  { key: "tasks", label: "Tasks & Operations", icon: "list-checks", badge: 3 },
];

const hidden = { includeHiddenElements: true } as const;

describe("NavRail", () => {
  it("is a navigation landmark of area buttons with the active one selected", async () => {
    await renderWithProviders(
      <NavRail items={AREAS} activeKey="hotels" onSelect={() => undefined} testID="rail" />,
    );
    expect(screen.getByTestId("rail")).toHaveProp("role", "navigation");
    expect(screen.getByTestId("rail")).toHaveProp("accessibilityLabel", "Workspace navigation");
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Hotels, 200" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Home" })).not.toBeSelected();
    // The web's mark for the current item of a navigation (react-native-web drops the selected state).
    expect(screen.getByRole("button", { name: "Hotels, 200" })).toHaveProp("aria-current", "page");
    expect(screen.getByRole("button", { name: "Home" })).not.toHaveProp("aria-current");
  });

  it("keeps a count's digits aligned on native", async () => {
    await renderWithProviders(
      <NavRail items={AREAS} activeKey="home" onSelect={() => undefined} />,
    );
    expect(JSON.stringify(screen.getByText("200").props.style)).toContain("tabular-nums");
  });

  it("reports the pressed area's key", async () => {
    const onSelect = jest.fn();
    await renderWithProviders(<NavRail items={AREAS} activeKey="home" onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole("button", { name: "Leads & Clients, 24" }));
    expect(onSelect).toHaveBeenCalledWith("leads");
  });

  it("paints the active area peacock with midnight text, the others pearl 80%", async () => {
    await renderWithProviders(
      <NavRail items={AREAS} activeKey="home" onSelect={() => undefined} testID="rail" />,
    );
    expect(screen.getByTestId("rail-home").props.className).toContain("bg-highlight");
    expect(screen.getByText("Home").props.className).toContain("text-highlight-ink");
    expect(screen.getByText("Hotels").props.className).toContain("text-body");
    expect(screen.getByTestId("rail-hotels").props.className).toContain("web:hover:bg-primary/8");
  });

  it("draws a count quietly and a badge in gold, and speaks the badge", async () => {
    await renderWithProviders(
      <NavRail items={AREAS} activeKey="home" onSelect={() => undefined} />,
    );
    expect(screen.getByText("200").props.className).toContain("text-muted");
    expect(screen.getByRole("button", { name: "Tasks & Operations, 3 waiting" })).toBeOnTheScreen();
    expect(screen.getByText("3", hidden)).toBeOnTheScreen();
    expect(JSON.stringify(screen.toJSON())).toContain("bg-brand");
  });

  it("shows the header and footer", async () => {
    await renderWithProviders(
      <NavRail
        items={AREAS}
        activeKey="home"
        onSelect={() => undefined}
        header={<Text>AMPM</Text>}
        footer={<Text>Eva M.</Text>}
      />,
    );
    expect(screen.getByText("AMPM")).toBeOnTheScreen();
    expect(screen.getByText("Eva M.")).toBeOnTheScreen();
  });

  it("keeps only icons when collapsed, with the labels as spoken names", async () => {
    await renderWithProviders(
      <NavRail items={AREAS} activeKey="home" onSelect={() => undefined} collapsed testID="rail" />,
    );
    expect(screen.queryByText("Hotels")).toBeNull();
    expect(screen.getByRole("button", { name: "Hotels, 200" })).toBeOnTheScreen();
    expect(screen.getByTestId("rail").props.className).toContain("w-20");
    expect(screen.getByTestId("rail-home").props.className).toContain("w-touch");
  });

  it("offers a collapse toggle only when it can be handled", async () => {
    const onToggle = jest.fn();
    await renderWithProviders(
      <NavRail
        items={AREAS}
        activeKey="home"
        onSelect={() => undefined}
        onToggleCollapsed={onToggle}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Collapse navigation" });
    expect(toggle).toBeExpanded();
    await fireEvent.press(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    await screen.rerender(<NavRail items={AREAS} activeKey="home" onSelect={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Collapse navigation" })).toBeNull();
  });

  it("names the toggle for expanding when collapsed", async () => {
    await renderWithProviders(
      <NavRail
        items={AREAS}
        activeKey="home"
        onSelect={() => undefined}
        collapsed
        onToggleCollapsed={() => undefined}
        expandLabel="Show labels"
      />,
    );
    expect(screen.getByRole("button", { name: "Show labels" })).not.toBeExpanded();
  });

  it("maps the rail and item states to the token classes", () => {
    expect(navRailStyles({ collapsed: false })).toContain("w-rail");
    expect(navRailStyles({})).toContain("rounded-2xl");
    expect(navRailItemStyles({ active: true })).toContain("bg-highlight");
    expect(navRailItemStyles({ active: false })).toContain("active:bg-primary/8");
    expect(navRailItemStyles({})).toContain("min-h-touch");
    expect(navRailItemStyles({})).toContain("rounded-full");
    expect(navRailItemStyles({})).toContain("web:focus-visible:shadow-halo");
  });
});
