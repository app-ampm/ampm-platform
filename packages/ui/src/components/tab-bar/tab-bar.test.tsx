import { AccessibilityInfo, Animated } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { motionMs } from "@ampm/tokens";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { TabBar } from "./tab-bar";
import type { TabBarItem } from "./tab-bar-item";
import { tabBarItemStyles, tabBarStyles } from "./tab-bar.styles";

const CLIENT_TABS: TabBarItem[] = [
  { key: "home", label: "Home" },
  { key: "hotels", label: "Hotels" },
  { key: "wedding", label: "My Wedding", locked: true },
  { key: "approvals", label: "Approvals", badge: 2 },
  { key: "more", label: "More" },
];

const TEAM_TABS: TabBarItem[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "weddings", label: "Weddings", icon: "heart" },
  { key: "tasks", label: "Tasks", icon: "list-checks", badge: 3 },
  { key: "more", label: "More", icon: "more" },
];

const hidden = { includeHiddenElements: true } as const;

const layout = (x: number) => ({ nativeEvent: { layout: { x, y: 0, width: 70, height: 44 } } });

async function measureTabs(keys: readonly string[]) {
  for (const [index, key] of keys.entries())
    await fireEvent(screen.getByTestId(`bar-${key}`), "layout", layout(index * 70));
}

describe("TabBar", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is a list of tabs with the active one selected", async () => {
    await renderWithProviders(
      <TabBar items={CLIENT_TABS} activeKey="hotels" onSelect={() => undefined} testID="bar" />,
    );
    expect(screen.getByTestId("bar")).toHaveProp("accessibilityRole", "tablist");
    expect(screen.getByTestId("bar")).toHaveProp("accessibilityLabel", "Main navigation");
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Hotels" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Home" })).not.toBeSelected();
  });

  it("reports the pressed tab's key, locked tabs included", async () => {
    const onSelect = jest.fn();
    await renderWithProviders(<TabBar items={CLIENT_TABS} activeKey="home" onSelect={onSelect} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Hotels" }));
    await fireEvent.press(screen.getByRole("tab", { name: "My Wedding, Locked" }));
    expect(onSelect.mock.calls).toEqual([["hotels"], ["wedding"]]);
  });

  it("dims a locked tab to pearl 32% and says it is locked", async () => {
    await renderWithProviders(
      <TabBar
        items={CLIENT_TABS}
        activeKey="home"
        onSelect={() => undefined}
        lockedLabel="opens when AMPM is appointed"
      />,
    );
    expect(
      screen.getByRole("tab", { name: "My Wedding, opens when AMPM is appointed" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("My Wedding").props.className).toContain("text-primary/32");
  });

  it("shows a count and speaks it", async () => {
    await renderWithProviders(
      <TabBar items={CLIENT_TABS} activeKey="home" onSelect={() => undefined} />,
    );
    expect(screen.getByRole("tab", { name: "Approvals, 2 waiting" })).toBeOnTheScreen();
    // The Badge draws the count; screen readers get it from the tab's label instead.
    expect(screen.queryByText("2")).toBeNull();
    expect(screen.getByText("2", hidden)).toBeOnTheScreen();
  });

  it("caps a large count at 99+", async () => {
    const items = [{ key: "approvals", label: "Approvals", badge: 140 }];
    await renderWithProviders(<TabBar items={items} activeKey="x" onSelect={() => undefined} />);
    expect(screen.getByText("99+", hidden)).toBeOnTheScreen();
  });

  it("paints the active tab peacock with a midnight label until the pill is measured", async () => {
    await renderWithProviders(
      <TabBar items={CLIENT_TABS} activeKey="home" onSelect={() => undefined} testID="bar" />,
    );
    expect(screen.getByTestId("bar-home").props.className).toContain("bg-highlight");
    expect(screen.getByText("Home").props.className).toContain("text-highlight-ink");
    expect(screen.getByText("Hotels").props.className).toContain("text-body");
    expect(screen.queryByTestId("bar-indicator")).toBeNull();
  });

  it("hands the fill to the sliding pill once the tabs are measured", async () => {
    await renderWithProviders(
      <TabBar items={CLIENT_TABS} activeKey="hotels" onSelect={() => undefined} testID="bar" />,
    );
    await measureTabs(CLIENT_TABS.map((item) => item.key));
    const indicator = await screen.findByTestId("bar-indicator");
    expect(indicator).toHaveStyle({ width: 70, transform: [{ translateX: 70 }] });
    expect(screen.getByTestId("bar-hotels").props.className).not.toContain("bg-highlight");
  });

  const team = (activeKey: string) => (
    <TabBar items={TEAM_TABS} activeKey={activeKey} onSelect={() => undefined} testID="bar" />
  );

  it("slides the pill to the new tab over the base duration", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderWithProviders(team("home"));
    await measureTabs(TEAM_TABS.map((item) => item.key));
    await screen.findByTestId("bar-indicator");
    await screen.rerender(team("tasks"));
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 140, duration: motionMs.base }),
    );
    // Still on its way (the jump is reserved for reduced motion).
    expect(screen.getByTestId("bar-indicator")).not.toHaveStyle({
      transform: [{ translateX: 140 }],
    });
  });

  it("jumps the pill to the new tab under reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderWithProviders(team("home"));
    await measureTabs(TEAM_TABS.map((item) => item.key));
    await screen.findByTestId("bar-indicator");
    const timing = jest.spyOn(Animated, "timing");
    await screen.rerender(team("tasks"));
    expect(screen.getByTestId("bar-indicator")).toHaveStyle({ transform: [{ translateX: 140 }] });
    expect(timing).not.toHaveBeenCalled();
  });

  it("floats 26 above the bottom safe-area inset, or sits in the flow", async () => {
    const metrics = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, bottom: 34, left: 0, right: 0 },
    };
    await renderWithProviders(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={TEAM_TABS} activeKey="home" onSelect={() => undefined} testID="bar" />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId("bar")).toHaveStyle({ bottom: 60 });
    expect(screen.getByTestId("bar").props.className).toContain("absolute");
    await screen.rerender(
      <TabBar
        items={TEAM_TABS}
        activeKey="home"
        onSelect={() => undefined}
        floating={false}
        testID="bar"
      />,
    );
    expect(screen.getByTestId("bar").props.className).not.toContain("absolute");
  });

  it("uses 11px labels for five tabs and 13px for four", async () => {
    await renderWithProviders(
      <TabBar items={CLIENT_TABS} activeKey="home" onSelect={() => undefined} />,
    );
    expect(screen.getByText("Hotels").props.className).toContain("text-xs");
    await screen.rerender(<TabBar items={TEAM_TABS} activeKey="home" onSelect={() => undefined} />);
    expect(screen.getByText("Weddings").props.className).toContain("text-sm");
  });

  it("maps the bar and tab states to the token classes", () => {
    expect(tabBarStyles({ floating: true })).toContain("inset-x-3.5");
    expect(tabBarStyles({})).toContain("rounded-full");
    expect(tabBarItemStyles({ filled: true })).toContain("bg-highlight");
    expect(tabBarItemStyles({ state: "inactive" })).toContain("web:hover:bg-primary/8");
    expect(tabBarItemStyles({ state: "active" })).not.toContain("hover:bg-primary/8");
    expect(tabBarItemStyles({})).toContain("min-h-touch");
    expect(tabBarItemStyles({})).toContain("web:focus-visible:shadow-halo");
  });
});
