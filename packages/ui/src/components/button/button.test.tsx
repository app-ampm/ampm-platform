import { createRef, type ComponentRef } from "react";
import { AccessibilityInfo, type Pressable } from "react-native";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/render";
import { Button } from "./button";
import { buttonLabelStyles, buttonStyles, type ButtonVariant } from "./button.styles";

const FILL: Record<ButtonVariant, readonly string[]> = {
  primary: ["bg-brand", "border-transparent", "active:bg-brand/85", "web:hover:bg-brand/85"],
  secondary: ["border-primary/40", "bg-transparent", "web:hover:bg-primary/8"],
  highlight: ["bg-highlight", "border-transparent", "active:bg-highlight/85"],
  glass: ["bg-surface/50", "border-primary/16", "web:shadow-rim"],
  ghost: ["bg-transparent", "border-transparent", "web:hover:bg-primary/8"],
  destructive: ["border-brand/50", "bg-transparent", "web:hover:bg-brand/8"],
};

const INK: Record<ButtonVariant, string> = {
  primary: "text-brand-ink",
  secondary: "text-primary",
  highlight: "text-highlight-ink",
  glass: "text-primary",
  ghost: "text-primary",
  destructive: "text-brand",
};

const variantNames: readonly ButtonVariant[] = [
  "primary",
  "secondary",
  "highlight",
  "glass",
  "ghost",
  "destructive",
];

describe("Button", () => {
  afterEach(() => jest.restoreAllMocks());

  it("calls onPress and is named by its label", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button onPress={onPress}>Save</Button>);
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks presses, exposes the state and draws the dashed outline when disabled", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button onPress={onPress} disabled>
        Unavailable
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Unavailable" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.className).toContain("border-dashed");
    expect(screen.getByText("Unavailable").props.className).toContain("text-primary/45");
  });

  it("shows a spinner, keeps the label and announces busy while loading", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button onPress={onPress} loading>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    expect(screen.getByTestId("button-spinner")).toBeOnTheScreen();
    expect(screen.getByText("Save")).toBeOnTheScreen();
    // Loading is not the disabled look: the fill stays.
    expect(button.props.className).toContain("bg-brand");
    expect(button.props.className).not.toContain("border-dashed");
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("holds the spinner still when the person reduces motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderWithProviders(<Button loading>Save</Button>);
    // The still indicator is decorative (the button itself announces busy), hence hidden elements.
    const still = () => screen.getByTestId("button-spinner-still", { includeHiddenElements: true });
    await waitFor(() => expect(still()).toBeOnTheScreen());
    expect(screen.queryByTestId("button-spinner")).toBeNull();
  });

  it("draws an icon-only button as a 44px circle named by its label", async () => {
    await renderWithProviders(
      <Button
        variant="glass"
        icon="heart"
        accessibilityLabel="Save hotel"
        onPress={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Save hotel" });
    for (const name of ["h-touch", "w-touch", "px-0", "rounded-full"])
      expect(button.props.className).toContain(name);
    expect(buttonStyles({ size: "lg", iconOnly: true })).toContain("h-12 w-12");
  });

  it("keeps the 44px minimum in every size and pads like the mocks", () => {
    expect(buttonStyles({ size: "sm" })).toContain("min-h-touch px-5");
    expect(buttonStyles({ size: "md" })).toContain("min-h-touch px-6");
    expect(buttonStyles({ size: "lg" })).toContain("min-h-12 px-7");
  });

  it("maps every variant to its Peacock Night fill as a pill with a focus halo", () => {
    for (const variant of variantNames) {
      const classes = buttonStyles({ variant });
      expect(classes).toContain("rounded-full");
      expect(classes).toContain("web:focus-visible:shadow-halo");
      for (const name of FILL[variant]) expect(classes).toContain(name);
    }
  });

  it("drops the fills and the hover tints for every disabled variant", () => {
    for (const variant of variantNames) {
      const classes = buttonStyles({ variant, disabled: true }).split(" ");
      expect(classes).toEqual(
        expect.arrayContaining(["border-dashed", "border-primary/26", "bg-transparent"]),
      );
      expect(classes.filter((name) => name.includes("hover:bg-"))).toEqual([]);
      expect(classes).not.toContain("bg-brand");
      expect(classes).not.toContain("web:shadow-rim");
    }
  });

  it("sets the label in Manrope 700 in the variant's ink at 13, 15 or 16", async () => {
    for (const variant of variantNames) {
      const label = buttonLabelStyles({ variant });
      expect(label).toContain(INK[variant]);
      expect(label).toContain("font-sans-bold");
    }
    expect(buttonLabelStyles({ size: "sm" })).toContain("text-sm");
    expect(buttonLabelStyles({ size: "md" })).toContain("text-base");
    expect(buttonLabelStyles({ size: "lg" })).toContain("text-lg");
    expect(buttonLabelStyles({ disabled: true })).toContain("text-primary/45");

    await renderWithProviders(<Button variant="highlight">Approve version 3</Button>);
    const label = screen.getByText("Approve version 3");
    expect(label.props.className).toContain("text-highlight-ink");
    expect(label.props.className).toContain("font-sans-bold");
    expect(label.props.accessibilityRole).toBeUndefined();
  });

  it("forwards its ref to the pressable", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(<Button ref={ref}>Save</Button>);
    expect(ref.current).not.toBeNull();
  });
});
