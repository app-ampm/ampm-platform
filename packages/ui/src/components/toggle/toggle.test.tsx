import { createRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Animated, StyleSheet, type Pressable } from "react-native";

import { motionMs } from "@ampm/tokens";

import { act, classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Toggle, type ToggleProps } from "./toggle";
import { TOGGLE_KNOB_TRAVEL, toggleKnobStyles, toggleTrackStyles } from "./toggle.styles";

/** The knob's moving wrapper: its style holds the slide (translateX from the track's centre). */
function knobStyle(testID: string): unknown {
  return StyleSheet.flatten(screen.getByTestId(`${testID}-knob`).props.style);
}

function atOffset(translateX: number) {
  return expect.objectContaining({ transform: [{ translateX }] });
}

/** The classes of the knob itself, inside its moving wrapper. */
function knobClasses(testID: string): readonly string[] {
  const knob = screen.getByTestId(`${testID}-knob`).children[0];
  return knob === undefined || typeof knob === "string" ? [] : classes(knob.props.className);
}

type HarnessProps = Omit<ToggleProps, "value" | "onValueChange"> & { readonly initial?: boolean };

function Harness({ initial = false, ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return <Toggle testID="remember" value={value} onValueChange={setValue} {...props} />;
}

describe("Toggle", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is a labelled switch that reports its state", async () => {
    await renderWithProviders(<Harness label="Remember this device" />);
    const toggle = screen.getByRole("switch", { name: "Remember this device" });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(toggle).toBeChecked();
  });

  it("calls onValueChange with the opposite value when the row is pressed", async () => {
    const onValueChange = jest.fn();
    await renderWithProviders(
      <Toggle label="Remember this device" value onValueChange={onValueChange} />,
    );
    await fireEvent.press(screen.getByText("Remember this device"));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it("does nothing when disabled, and says so", async () => {
    const onValueChange = jest.fn();
    await renderWithProviders(
      <Toggle
        testID="remember"
        label="Remember this device"
        value={false}
        onValueChange={onValueChange}
        disabled
      />,
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeDisabled();
    await fireEvent.press(toggle);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(classes(screen.getByTestId("remember-track").props.className)).toContain("opacity-45");
    expect(classes(screen.getByText("Remember this device").props.className)).toContain(
      "text-primary/45",
    );
  });

  it("reads the description after the label", async () => {
    await renderWithProviders(
      <Harness label="Remember this device" description="Stay signed in for 30 days" />,
    );
    expect(screen.getByRole("switch")).toHaveProp(
      "accessibilityHint",
      "Stay signed in for 30 days",
    );
    expect(classes(screen.getByText("Stay signed in for 30 days").props.className)).toContain(
      "text-muted",
    );
  });

  it("hands its ref to the pressable row", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(
      <Toggle ref={ref} label="Remember" value onValueChange={jest.fn()} />,
    );
    expect(ref.current).not.toBeNull();
  });

  it("takes an accessibility label when it has no visible one", async () => {
    await renderWithProviders(<Harness accessibilityLabel="Show to clients" />);
    expect(screen.getByRole("switch", { name: "Show to clients" })).toBeOnTheScreen();
  });

  it("is gold with a midnight knob when on, pearl when off", async () => {
    await renderWithProviders(<Harness label="Remember this device" />);
    expect(classes(screen.getByTestId("remember-track").props.className)).toContain(
      "bg-primary/12",
    );
    expect(knobClasses("remember")).toContain("bg-primary/45");
    await fireEvent.press(screen.getByRole("switch"));
    expect(classes(screen.getByTestId("remember-track").props.className)).toContain("bg-brand");
    expect(knobClasses("remember")).toContain("bg-brand-ink");
  });

  it("starts the knob at the end when the switch is on", async () => {
    await renderWithProviders(<Harness initial label="Remember this device" />);
    expect(knobStyle("remember")).toEqual(atOffset(TOGGLE_KNOB_TRAVEL));
  });

  it("slides the knob over the fast duration", async () => {
    const timing = jest.spyOn(Animated, "timing");
    await renderWithProviders(<Harness label="Remember this device" />);
    expect(knobStyle("remember")).toEqual(atOffset(-TOGGLE_KNOB_TRAVEL));
    await fireEvent.press(screen.getByRole("switch"));
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, duration: motionMs.fast }),
    );
  });

  // The jump is Animated.Value#setValue, which updates the native view directly, so the test checks
  // that no slide runs rather than reading the knob's position.
  it("jumps the knob without sliding under reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const timing = jest.spyOn(Animated, "timing");
    await renderWithProviders(<Harness label="Remember this device" />);
    await act(async () => undefined);
    timing.mockClear();
    await fireEvent.press(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toBeChecked();
    expect(timing).not.toHaveBeenCalled();
  });

  it("draws the track and knob from the tokens, with the gold border and halo on keyboard focus", () => {
    expect(classes(toggleTrackStyles({ on: true }))).toEqual(
      expect.arrayContaining(["bg-brand", "h-7", "w-12", "rounded-full"]),
    );
    expect(classes(toggleTrackStyles({ on: false }))).toContain("bg-primary/12");
    // The stroke is there in every state (transparent), so focus colours it without a size change.
    expect(classes(toggleTrackStyles())).toEqual(
      expect.arrayContaining([
        "border",
        "border-transparent",
        "web:group-focus-visible:border-brand",
        "web:group-focus-visible:shadow-halo",
      ]),
    );
    expect(classes(toggleKnobStyles({ on: true }))).toEqual(
      expect.arrayContaining(["bg-brand-ink", "h-5.5", "w-5.5"]),
    );
    expect(TOGGLE_KNOB_TRAVEL).toBe(10);
  });
});
