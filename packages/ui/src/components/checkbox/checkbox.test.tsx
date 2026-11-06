import { createRef, useState, type ComponentRef } from "react";
import type { Pressable } from "react-native";

import { colors } from "@ampm/tokens";

import { spyOnAnnounce } from "../../test/announce";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Checkbox, type CheckboxProps } from "./checkbox";
import { checkboxBoxStyles, checkboxRowStyles } from "./checkbox.styles";

type HarnessProps = Omit<CheckboxProps, "checked" | "onCheckedChange"> & {
  readonly initial?: boolean;
};

function Harness({ initial = false, ...props }: HarnessProps) {
  const [checked, setChecked] = useState(initial);
  return <Checkbox testID="demo" checked={checked} onCheckedChange={setChecked} {...props} />;
}

describe("Checkbox", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is a labelled checkbox that ticks when the row is pressed", async () => {
    await renderWithProviders(<Harness label="I'd like a demo of hotel discovery" />);
    const box = screen.getByRole("checkbox", { name: "I'd like a demo of hotel discovery" });
    expect(box).not.toBeChecked();
    await fireEvent.press(screen.getByText("I'd like a demo of hotel discovery"));
    expect(box).toBeChecked();
  });

  it("calls onCheckedChange with the opposite value", async () => {
    const onCheckedChange = jest.fn();
    await renderWithProviders(
      <Checkbox label="Mehendi" checked onCheckedChange={onCheckedChange} />,
    );
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("is peacock with a midnight check when ticked, a pearl stroke when not", async () => {
    await renderWithProviders(<Harness label="Mehendi" />);
    expect(classes(screen.getByTestId("demo-box").props.className)).toContain("border-primary/34");
    expect(JSON.stringify(screen.toJSON())).not.toContain(colors["highlight-ink"].light);
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(classes(screen.getByTestId("demo-box").props.className)).toEqual(
      expect.arrayContaining(["bg-highlight", "border-highlight"]),
    );
    expect(JSON.stringify(screen.toJSON())).toContain(
      `"stroke":"${colors["highlight-ink"].light}"`,
    );
  });

  it("does nothing when disabled, and says so", async () => {
    const onCheckedChange = jest.fn();
    await renderWithProviders(
      <Checkbox
        testID="demo"
        label="Send me occasional news from AMPM"
        checked={false}
        onCheckedChange={onCheckedChange}
        disabled
      />,
    );
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    await fireEvent.press(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(classes(screen.getByTestId("demo-box").props.className)).toContain("opacity-45");
    expect(
      classes(screen.getByText("Send me occasional news from AMPM").props.className),
    ).toContain("text-primary/45");
  });

  it("shows an error in gold, on a gold stroke, and announces it", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(
      <Harness label="I've read the privacy notice" errorText="Tick the privacy notice to go on" />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Tick the privacy notice to go on");
    expect(classes(alert.props.className)).toContain("text-brand");
    expect(classes(screen.getByTestId("demo-box").props.className)).toContain("border-brand");
    expect(screen.getByRole("checkbox")).toHaveProp("aria-invalid", true);
    expect(announce).toHaveBeenCalledWith("Tick the privacy notice to go on", { queue: true });
  });

  it("gives screen readers the description and the error after the label", async () => {
    await renderWithProviders(
      <Harness
        label="I've read the privacy notice"
        description="Asked once, on your first sign-in."
        errorText="Tick the privacy notice to go on"
      />,
    );
    expect(screen.getByRole("checkbox")).toHaveProp(
      "accessibilityHint",
      "Tick the privacy notice to go on. Asked once, on your first sign-in.",
    );
    expect(
      classes(screen.getByText("Asked once, on your first sign-in.").props.className),
    ).toContain("text-muted");
  });

  it("hands its ref to the pressable row", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(
      <Checkbox ref={ref} label="Mehendi" checked={false} onCheckedChange={jest.fn()} />,
    );
    expect(ref.current).not.toBeNull();
  });

  it("puts the label in pearl 80%", async () => {
    await renderWithProviders(<Harness label="Mehendi" />);
    expect(classes(screen.getByText("Mehendi").props.className)).toContain("text-body");
  });

  it("draws the box from the tokens, with a 44px row and the halo on keyboard focus", () => {
    expect(classes(checkboxBoxStyles({ checked: true }))).toEqual(
      expect.arrayContaining(["bg-highlight", "h-5.5", "w-5.5", "rounded-sm"]),
    );
    expect(classes(checkboxBoxStyles({ checked: false }))).toContain("border-primary/34");
    expect(classes(checkboxBoxStyles({ checked: true, invalid: true }))).toContain("border-brand");
    expect(classes(checkboxBoxStyles({ checked: true, invalid: true }))).not.toContain(
      "border-highlight",
    );
    expect(classes(checkboxBoxStyles())).toContain("web:group-focus-visible:shadow-halo");
    expect(classes(checkboxRowStyles())).toEqual(expect.arrayContaining(["min-h-touch", "group"]));
  });
});
