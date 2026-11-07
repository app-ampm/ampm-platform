import { createRef, type ComponentRef } from "react";
import { type Pressable } from "react-native";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { focusRingStyles } from "../glass-panel";
import { TextAction } from "./text-action";

describe("TextAction", () => {
  it("is a gold button with a 44px target and the focus border and halo", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<TextAction label="Retry now" onPress={onPress} />);
    const action = screen.getByRole("button", { name: "Retry now" });
    // The stroke exists before focus (transparent), so web:focus-visible:border-brand has a border
    // to colour and focus never moves the text.
    expect(classes(action.props.className)).toEqual(
      expect.arrayContaining([
        "min-h-touch",
        "min-w-touch",
        "border",
        "border-transparent",
        ...classes(focusRingStyles),
      ]),
    );
    expect(classes(screen.getByText("Retry now").props.className)).toEqual(
      expect.arrayContaining(["text-brand", "font-sans-bold"]),
    );
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports and honours the disabled state", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<TextAction label="Retry now" onPress={onPress} disabled />);
    const action = screen.getByRole("button", { name: "Retry now" });
    expect(action).toBeDisabled();
    expect(classes(screen.getByText("Retry now").props.className)).toContain("text-primary/45");
    await fireEvent.press(action);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("forwards its ref to the pressable", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(<TextAction ref={ref} label="View" onPress={() => undefined} />);
    expect(ref.current).not.toBeNull();
  });
});
