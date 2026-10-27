import { spyOnAnnounce } from "../../test/announce";
import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Input } from "./input";
import { fieldStyles } from "./input.styles";

describe("Input", () => {
  it("is labelled and reports changes", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<Input label="Guest name" onChangeText={onChangeText} />);
    const field = screen.getByLabelText("Guest name");
    await fireEvent.changeText(field, "Priya");
    expect(onChangeText).toHaveBeenCalledWith("Priya");
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
    { accessibilityElementsHidden: true },
    { "aria-hidden": true },
  ])("keeps the error silent on iOS while the field is hidden (%o)", async (hiding) => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Input label="Phone" errorText="Enter a number" {...hiding} />);
    expect(announce).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("cannot be edited when disabled", async () => {
    await renderWithProviders(<Input label="Reference" disabled defaultValue="AMPM-1" />);
    expect(screen.getByLabelText("Reference")).toBeDisabled();
  });

  it("styles each state from the tokens", async () => {
    expect(fieldStyles({ state: "error" })).toContain("border-danger");
    expect(fieldStyles({ state: "focused" })).toContain("border-brand");
    expect(fieldStyles({ state: "disabled" })).toContain("bg-surface-inset");
    expect(fieldStyles({ size: "md" })).toContain("min-h-touch");
  });
});
