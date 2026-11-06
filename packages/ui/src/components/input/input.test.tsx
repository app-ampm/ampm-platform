import { colors } from "@ampm/tokens";

import { spyOnAnnounce } from "../../test/announce";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Input } from "./input";
import { fieldStyles, fieldTextStyles } from "./input.styles";

/** The frame around the field's text input: its parent view. */
function frameOf(label: string): readonly string[] {
  return classes(screen.getByLabelText(label).parent?.props.className);
}

describe("Input", () => {
  it("is labelled and reports changes", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<Input label="Guest name" onChangeText={onChangeText} />);
    const field = screen.getByLabelText("Guest name");
    await fireEvent.changeText(field, "Priya");
    expect(onChangeText).toHaveBeenCalledWith("Priya");
  });

  // The asterisk is drawn; the words say it. Read as "star" it would mean nothing.
  it("says a required field is required, never 'star'", async () => {
    await renderWithProviders(<Input label="Work email" required testID="email" />);
    const field = screen.getByTestId("email");
    expect(field).toHaveProp("accessibilityLabel", "Work email, required");
    expect(field).toHaveProp("aria-required", true);
    // The label element says it too, where a screen reader stops on it; its asterisk is drawn only.
    expect(screen.getByText("Work email", { exact: false })).toHaveProp(
      "accessibilityLabel",
      "Work email, required",
    );
    expect(screen.getByText("*", { exact: false, includeHiddenElements: true })).toHaveProp(
      "aria-hidden",
      true,
    );
  });

  it("names an optional field by its label alone", async () => {
    await renderWithProviders(<Input label="Company" testID="company" />);
    expect(screen.getByTestId("company")).toHaveProp("accessibilityLabel", "Company");
    expect(screen.getByTestId("company")).toHaveProp("aria-required", false);
    expect(screen.queryByText("*", { exact: false, includeHiddenElements: true })).toBeNull();
  });

  it("shows help text, and the error instead of it", async () => {
    const { rerender } = await renderWithProviders(<Input label="Phone" helpText="10 digits" />);
    expect(screen.getByText("10 digits")).toBeOnTheScreen();
    await rerender(
      <Input label="Phone" helpText="10 digits" errorText="Enter a 10-digit number" />,
    );
    expect(screen.queryByText("10 digits")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a 10-digit number");
    expect(screen.getByLabelText("Phone")).toHaveProp("aria-invalid", true);
  });

  it("shows the error in gold, on a gold stroke, and keeps what was typed", async () => {
    await renderWithProviders(
      <Input label="Mobile number" value="98765" errorText="Enter the 10-digit mobile number" />,
    );
    expect(classes(screen.getByRole("alert").props.className)).toContain("text-brand");
    expect(frameOf("Mobile number")).toContain("border-brand");
    expect(screen.getByLabelText("Mobile number")).toHaveDisplayValue("98765");
  });

  it("puts the help line in pearl 58% and the label in pearl 80%", async () => {
    await renderWithProviders(<Input label="Guest name" helpText="As on the invitation" />);
    expect(classes(screen.getByText("As on the invitation").props.className)).toContain(
      "text-muted",
    );
    expect(classes(screen.getByText("Guest name").props.className)).toContain("text-body");
  });

  it("announces the error, and not the help text, on iOS", async () => {
    const announce = spyOnAnnounce();
    const { rerender } = await renderWithProviders(<Input label="Phone" helpText="10 digits" />);
    expect(announce).not.toHaveBeenCalled();
    await rerender(
      <Input label="Phone" helpText="10 digits" errorText="Enter a 10-digit number" />,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Enter a 10-digit number", { queue: true });
    jest.restoreAllMocks();
  });

  // Announcing (ui.md) a field hidden from VoiceOver makes it speak what the user cannot reach,
  // the rule Callout, StateView and OfflineState already follow (isHiddenFromVoiceOver).
  it.each([
    { className: "hidden" },
    { className: "native:hidden" },
    { className: "hidden web:flex" },
  ])("keeps the error silent on iOS while the field is hidden (%o)", async (hiding) => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Input label="Phone" errorText="Enter a number" {...hiding} />);
    expect(announce).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  // These props reach the text input only: the label and the alert message stay in the
  // accessibility tree, so VoiceOver can still reach the error and ui.md:13 wants it announced.
  it.each([{ accessibilityElementsHidden: true }, { "aria-hidden": true }])(
    "still announces the error on iOS when only the text input is hidden (%o)",
    async (hiding) => {
      const announce = spyOnAnnounce();
      await renderWithProviders(<Input label="Phone" errorText="Enter a number" {...hiding} />);
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a number");
      expect(announce).toHaveBeenCalledWith("Enter a number", { queue: true });
      jest.restoreAllMocks();
    },
  );

  it("cannot be edited when disabled, and dims its text", async () => {
    await renderWithProviders(<Input label="Reference" disabled defaultValue="AMPM-1" />);
    const field = screen.getByLabelText("Reference");
    expect(field).toBeDisabled();
    expect(classes(field.props.className)).toContain("text-primary/45");
    expect(frameOf("Reference")).toEqual(expect.arrayContaining(["border-dashed"]));
  });

  it("shows a prefix before the value with a divider, and stays labelled by its label", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(
      <Input label="Mobile number" prefix="+91" onChangeText={onChangeText} />,
    );
    const prefix = screen.getByText("+91");
    expect(classes(prefix.props.className)).toContain("text-primary/60");
    const divider = prefix.parent?.children.find(
      (child) => typeof child !== "string" && classes(child.props.className).includes("w-px"),
    );
    expect(divider).toBeDefined();
    await fireEvent.changeText(screen.getByLabelText("Mobile number"), "98765 43210");
    expect(onChangeText).toHaveBeenCalledWith("98765 43210");
  });

  it("draws the gold stroke while focused, and the pearl stroke after", async () => {
    await renderWithProviders(<Input label="Email" />);
    expect(frameOf("Email")).toContain("border-primary/20");
    await fireEvent(screen.getByLabelText("Email"), "focus");
    expect(frameOf("Email")).toContain("border-brand");
    await fireEvent(screen.getByLabelText("Email"), "blur");
    expect(frameOf("Email")).toContain("border-primary/20");
  });

  it("takes the panel radius and a taller minimum when multiline", async () => {
    await renderWithProviders(<Input label="Anything else?" multiline />);
    expect(frameOf("Anything else?")).toContain("rounded-lg");
    expect(frameOf("Anything else?")).not.toContain("rounded-full");
    expect(classes(screen.getByLabelText("Anything else?").props.className)).toContain("min-h-24");
  });

  it("colours the placeholder pearl 58% from the tokens", async () => {
    await renderWithProviders(<Input label="Email" placeholder="you@example.com" />);
    expect(screen.getByLabelText("Email")).toHaveProp("placeholderTextColor", colors.muted.light);
  });

  it("styles each state from the tokens", () => {
    expect(classes(fieldStyles())).toEqual(
      expect.arrayContaining(["rounded-full", "bg-surface/50", "border-primary/20", "px-4.5"]),
    );
    expect(classes(fieldStyles({ state: "error" }))).toContain("border-brand");
    expect(classes(fieldStyles({ state: "focused" }))).toEqual(
      expect.arrayContaining(["border-brand", "web:shadow-halo"]),
    );
    expect(classes(fieldStyles({ state: "disabled" }))).toEqual(
      expect.arrayContaining(["border-dashed", "border-primary/26"]),
    );
    expect(classes(fieldStyles({ size: "md" }))).toContain("min-h-touch");
    expect(classes(fieldTextStyles())).toEqual(
      expect.arrayContaining(["py-3.5", "font-sans", "text-base", "text-primary"]),
    );
  });

  it("keeps a flex frame for the website's plain inputs", () => {
    expect(classes(fieldStyles())).toEqual(
      expect.arrayContaining(["flex", "flex-row", "web:focus-within:shadow-halo"]),
    );
  });
});
