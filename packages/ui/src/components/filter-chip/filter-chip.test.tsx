import { createRef, type ComponentRef } from "react";
import type { Pressable } from "react-native";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { focusRingStyles, groupFocusRingStyles } from "../glass-panel";
import { FilterChip } from "./filter-chip";
import { filterChipLabelStyles, filterChipStyles } from "./filter-chip.styles";

describe("FilterChip", () => {
  it("is a button named by its label that reports presses", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<FilterChip label="Heritage" onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Heritage" });
    expect(chip).not.toBeSelected();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("exposes the selected state and turns solid peacock with a midnight label", async () => {
    await renderWithProviders(<FilterChip label="Lake view" selected testID="chip" />);
    const chip = screen.getByRole("button", { name: "Lake view" });
    expect(chip).toBeSelected();
    expect(chip.props["aria-pressed"]).toBe(true);
    expect(classes(screen.getByTestId("chip-pill").props.className)).toContain("bg-highlight");
    expect(classes(screen.getByText("Lake view").props.className)).toContain("text-highlight-ink");
  });

  it("draws an unselected chip as a pearl 30% outline with a hover tint", async () => {
    await renderWithProviders(<FilterChip label="Palace" testID="chip" />);
    expect(classes(screen.getByTestId("chip-pill").props.className)).toEqual(
      expect.arrayContaining([
        "border-primary/30",
        "rounded-full",
        "px-3.5",
        "py-2",
        // The target around the pill takes the pointer and the press; the pill follows its group.
        "web:group-hover:bg-primary/8",
        "group-active:bg-primary/12",
      ]),
    );
    expect(classes(screen.getByText("Palace").props.className)).toContain("text-primary");
  });

  it("blocks presses and dims to the dashed look when disabled", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<FilterChip label="300+" disabled onPress={onPress} testID="chip" />);
    const chip = screen.getByRole("button", { name: "300+" });
    expect(chip).toBeDisabled();
    await fireEvent.press(chip);
    expect(onPress).not.toHaveBeenCalled();
    expect(classes(screen.getByTestId("chip-pill").props.className)).toContain("border-dashed");
    expect(classes(screen.getByText("300+").props.className)).toContain("text-primary/45");
  });

  it("shows a count after the label and reads it out", async () => {
    await renderWithProviders(<FilterChip label="Filters" icon="sliders" count={2} />);
    expect(screen.getByText("Filters · 2")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Filters, 2" })).toBeOnTheScreen();
  });

  // The pressable is the target, so the web (where Pressable has no hitSlop) gets 44 too: the 38
  // pill (a 20 line, 8 above and below, a 1px stroke) and 4 more above and below it.
  it("makes the pressable a 46 target laid out as tall as the pill, with the focus ring", async () => {
    await renderWithProviders(<FilterChip label="Heritage" testID="chip" />);
    const chip = screen.getByRole("button", { name: "Heritage" });
    expect(chip).not.toHaveProp("hitSlop");
    expect(classes(chip.props.className)).toEqual(
      expect.arrayContaining(["group", "-my-1", "py-1", "web:outline-none"]),
    );
    expect(classes(screen.getByTestId("chip-pill").props.className)).toEqual(
      expect.arrayContaining(["min-w-touch", "border", "py-2", ...classes(groupFocusRingStyles)]),
    );
    expect(20 + 2 * (8 + 1) + 2 * 4).toBeGreaterThanOrEqual(44);
  });

  it("keeps the stroke in every state so toggling never shifts the row", () => {
    expect(classes(filterChipStyles({ selected: true }))).toContain("border-transparent");
    expect(classes(filterChipStyles({ selected: false }))).toContain("border-primary/30");
    expect(filterChipStyles({ selected: true, disabled: true })).not.toContain("hover:");
    expect(filterChipLabelStyles()).toContain("font-sans-semibold");
  });

  it("is one focusable element on the website: its own hover, press and focus ring", () => {
    expect(classes(filterChipStyles())).toEqual(
      expect.arrayContaining([
        "web:hover:bg-primary/8",
        "active:bg-primary/12",
        ...classes(focusRingStyles),
      ]),
    );
    expect(filterChipStyles()).not.toContain("group-");
  });

  it("forwards its ref to the pressable", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(<FilterChip ref={ref} label="Heritage" />);
    expect(ref.current).not.toBeNull();
  });
});
