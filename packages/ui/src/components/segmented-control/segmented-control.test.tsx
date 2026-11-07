import { useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";

import { motionMs } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { focusRingStyles, groupFocusRingStyles } from "../glass-panel";
import {
  SegmentedControl,
  centredScrollX,
  type SegmentedControlOption,
  type SegmentedControlProps,
} from "./segmented-control";
import {
  segmentLabelStyles,
  segmentStyles,
  segmentedTrackStyles,
} from "./segmented-control.styles";

const HOTEL_TABS: readonly SegmentedControlOption[] = [
  { value: "overview", label: "Overview" },
  { value: "rooms", label: "Rooms" },
  { value: "venues", label: "Venues" },
  { value: "rates", label: "Rates" },
];

type HarnessProps = Omit<SegmentedControlProps, "value" | "onChange"> & {
  readonly initial: string;
};

function Harness({ initial, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return <SegmentedControl testID="tabs" value={value} onChange={setValue} {...props} />;
}

/** Lays the segments out 80 wide and 4 apart, as the row measures them. */
async function measureSegments(options: readonly SegmentedControlOption[]) {
  for (const [index, option] of options.entries()) {
    const layout = { x: index * 84, y: 0, width: 80, height: 38 };
    await fireEvent(screen.getByTestId(`tabs-${option.value}`), "layout", {
      nativeEvent: { layout },
    });
  }
}

describe("SegmentedControl", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is a named tab list whose selected tab says so", async () => {
    await renderWithProviders(
      <Harness accessibilityLabel="Hotel sections" options={HOTEL_TABS} initial="overview" />,
    );
    // The list stays a container, not one accessibility element (that would merge its tabs into one
    // VoiceOver element), so getByRole does not match it: its role and name are read off the view.
    const list = screen.getByTestId("tabs");
    expect(list).toHaveProp("accessibilityRole", "tablist");
    expect(list).toHaveProp("accessibilityLabel", "Hotel sections");
    expect(list).not.toHaveProp("accessible", true);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Rooms" })).not.toBeSelected();
  });

  it("selects the tab that is pressed", async () => {
    await renderWithProviders(
      <Harness accessibilityLabel="Hotel sections" options={HOTEL_TABS} initial="overview" />,
    );
    await fireEvent.press(screen.getByRole("tab", { name: "Rates" }));
    expect(screen.getByRole("tab", { name: "Rates" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Overview" })).not.toBeSelected();
  });

  it("does not report the tab that is already selected", async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <SegmentedControl
        accessibilityLabel="Hotel sections"
        options={HOTEL_TABS}
        value="overview"
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByRole("tab", { name: "Overview" }));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("tab", { name: "Venues" }));
    expect(onChange).toHaveBeenCalledWith("venues");
  });

  it("skips a disabled tab and dims its label", async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <SegmentedControl
        accessibilityLabel="Hotel sections"
        options={[...HOTEL_TABS, { value: "menus", label: "Menus", disabled: true }]}
        value="overview"
        onChange={onChange}
      />,
    );
    const menus = screen.getByRole("tab", { name: "Menus" });
    expect(menus).toBeDisabled();
    await fireEvent.press(menus);
    expect(onChange).not.toHaveBeenCalled();
    expect(classes(screen.getByText("Menus").props.className)).toContain("text-primary/45");
  });

  it("shows a count after the label, spoken without the middle dot", async () => {
    await renderWithProviders(
      <Harness
        accessibilityLabel="Approvals"
        options={[
          { value: "waiting", label: "Waiting", badge: 4 },
          { value: "decided", label: "Decided", badge: 11 },
        ]}
        initial="waiting"
      />,
    );
    expect(screen.getByText(uiCopy.segmentedControl.withBadge("Waiting", 4))).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Waiting, 4" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Decided, 11" })).toBeOnTheScreen();
  });

  it("puts the selected tab on a peacock pill with a midnight label", async () => {
    await renderWithProviders(
      <Harness accessibilityLabel="Hotel sections" options={HOTEL_TABS} initial="rooms" />,
    );
    // Before the segments are measured, the selected pill paints itself.
    expect(classes(screen.getByTestId("tabs-rooms-pill").props.className)).toContain(
      "bg-highlight",
    );
    expect(classes(screen.getByText("Rooms").props.className)).toContain("text-highlight-ink");
    expect(classes(screen.getByTestId("tabs-rates-pill").props.className)).not.toContain(
      "bg-highlight",
    );
    expect(classes(screen.getByText("Rates").props.className)).toContain("text-body");
    expect(screen.queryByTestId("tabs-indicator")).toBeNull();
  });

  it("hands the fill to the sliding pill once the segments are measured", async () => {
    await renderWithProviders(
      <Harness accessibilityLabel="Hotel sections" options={HOTEL_TABS} initial="rooms" />,
    );
    await measureSegments(HOTEL_TABS);
    const indicator = await screen.findByTestId("tabs-indicator");
    expect(indicator).toHaveStyle({ width: 80, transform: [{ translateX: 84 }] });
    expect(classes(indicator.props.className)).toEqual(
      expect.arrayContaining(["absolute", "inset-y-0", "rounded-full", "bg-highlight"]),
    );
    expect(classes(screen.getByTestId("tabs-rooms-pill").props.className)).not.toContain(
      "bg-highlight",
    );
    expect(classes(screen.getByText("Rooms").props.className)).toContain("text-highlight-ink");
  });

  it("slides the pill to the next selection over the base duration", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderWithProviders(
      <Harness accessibilityLabel="Hotel sections" options={HOTEL_TABS} initial="overview" />,
    );
    await measureSegments(HOTEL_TABS);
    await screen.findByTestId("tabs-indicator");
    await fireEvent.press(screen.getByRole("tab", { name: "Rates" }));
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 252, duration: motionMs.base }),
    );
    // Still on its way: the jump is for reduced motion only.
    expect(screen.getByTestId("tabs-indicator")).not.toHaveStyle({
      transform: [{ translateX: 252 }],
    });
  });

  it("jumps the pill to the next selection under reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderWithProviders(
      <Harness accessibilityLabel="Hotel sections" options={HOTEL_TABS} initial="overview" />,
    );
    await measureSegments(HOTEL_TABS);
    await screen.findByTestId("tabs-indicator");
    const timing = jest.spyOn(Animated, "timing");
    await fireEvent.press(screen.getByRole("tab", { name: "Rates" }));
    expect(screen.getByTestId("tabs-indicator")).toHaveStyle({ transform: [{ translateX: 252 }] });
    expect(timing).not.toHaveBeenCalled();
  });

  it("spans the width and shares it equally when fullWidth", async () => {
    await renderWithProviders(
      <Harness
        accessibilityLabel="Request type"
        fullWidth
        options={[
          { value: "enquiry", label: "Send an enquiry" },
          { value: "demo", label: "Request a demo" },
        ]}
        initial="demo"
      />,
    );
    expect(classes(screen.getByTestId("tabs").props.className)).toContain("self-stretch");
    expect(classes(screen.getByTestId("tabs-enquiry").props.className)).toContain("flex-1");
  });

  // The pressable is the target itself, so the web (where Pressable has no hitSlop) gets 44 too: a
  // 20 line in a pill with a 1px stroke, plus the target's own padding above and below.
  it.each([
    { size: "md", pill: ["px-4", "py-2"], target: ["-my-1", "py-1"], height: 20 + 2 * (8 + 1 + 4) },
    { size: "sm", pill: ["px-3", "py-1.5"], target: ["-my-1.5", "py-1.5"], height: 20 + 2 * 13 },
  ] as const)(
    "makes the $size pressable at least 44 tall",
    async ({ size, pill, target, height }) => {
      await renderWithProviders(
        <Harness accessibilityLabel="Season" size={size} options={HOTEL_TABS} initial="overview" />,
      );
      const tab = screen.getByTestId("tabs-rooms");
      expect(tab).not.toHaveProp("hitSlop");
      expect(classes(tab.props.className)).toEqual(expect.arrayContaining(["group", ...target]));
      expect(classes(screen.getByTestId("tabs-rooms-pill").props.className)).toEqual(
        expect.arrayContaining(["min-w-touch", "border", "border-transparent", ...pill]),
      );
      expect(height).toBeGreaterThanOrEqual(44);
    },
  );

  it("scrolls inside a full-width track when scrollable", async () => {
    await renderWithProviders(
      <Harness
        accessibilityLabel="Hotel sections"
        scrollable
        options={HOTEL_TABS}
        initial="rates"
      />,
    );
    const strip = screen.getByTestId("tabs");
    expect(strip).toHaveProp("accessibilityRole", "tablist");
    expect(strip).toHaveProp("horizontal", true);
    expect(classes(strip.props.className)).toEqual(
      expect.arrayContaining(["rounded-full", "overflow-hidden", "self-stretch"]),
    );
    expect(screen.getByRole("tab", { name: "Rates" })).toBeSelected();
  });

  it("centres the selected segment of a scrolling strip, never before its start", () => {
    expect(centredScrollX({ x: 300, width: 80 }, 200)).toBe(240);
    expect(centredScrollX({ x: 4, width: 92 }, 354)).toBe(0);
    expect(centredScrollX(undefined, 354)).toBeNull();
    expect(centredScrollX({ x: 300, width: 80 }, 0)).toBeNull();
  });

  it("draws the track and segments from the tokens", () => {
    expect(classes(segmentedTrackStyles())).toEqual(
      expect.arrayContaining([
        "flex",
        "rounded-full",
        "border-primary/16",
        "bg-surface/50",
        "p-1",
        "gap-1",
      ]),
    );
    expect(classes(segmentStyles({ selected: true }))).toEqual(
      expect.arrayContaining(["bg-highlight", "rounded-full", "px-4", "py-2", "flex"]),
    );
    // Under the sliding pill the selected segment is clear, so the pill shows through.
    expect(classes(segmentStyles({ selected: true, indicator: true }))).toContain("bg-transparent");
    expect(classes(segmentStyles({ selected: false }))).toContain("web:hover:bg-primary/8");
    expect(classes(segmentStyles({ selected: true }))).not.toContain("web:hover:bg-primary/8");
    // Focus: the gold border (on a stroke that is always there) and the halo, on the pill itself on
    // the website and through the 44px target's group in the app.
    expect(classes(segmentStyles())).toEqual(
      expect.arrayContaining([
        "border",
        "border-transparent",
        ...classes(focusRingStyles),
        "active:bg-primary/8",
      ]),
    );
    expect(classes(segmentStyles({ nested: true }))).toEqual(
      expect.arrayContaining([
        ...classes(groupFocusRingStyles),
        "group-active:bg-primary/8",
        "web:group-hover:bg-primary/8",
      ]),
    );
    expect(classes(segmentStyles({ nested: true }))).not.toContain(
      "web:focus-visible:border-brand",
    );
    expect(classes(segmentLabelStyles({ state: "selected" }))).toEqual(
      expect.arrayContaining(["text-highlight-ink", "font-sans-semibold", "text-sm"]),
    );
  });
});
