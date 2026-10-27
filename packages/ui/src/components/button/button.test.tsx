import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Button } from "./button";
import { buttonStyles } from "./button.styles";

describe("Button", () => {
  it("calls onPress and is named by its label", async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button onPress={onPress}>Save</Button>);
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks presses and exposes the state when disabled", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Button onPress={onPress} disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
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
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("needs a label for icon-only use and keeps the 44px target in every size", async () => {
    await renderWithProviders(
      <Button icon="x" accessibilityLabel="Close" onPress={() => undefined} />,
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    for (const size of ["sm", "md"] as const)
      expect(buttonStyles({ size })).toContain("min-h-touch");
    expect(buttonStyles({ size: "lg" })).toContain("min-h-12");
  });
});
