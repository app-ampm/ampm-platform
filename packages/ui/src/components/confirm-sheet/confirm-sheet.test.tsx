import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Input } from "../input";
import { ConfirmSheet } from "./confirm-sheet";

describe("ConfirmSheet", () => {
  it("confirms the action and can be cancelled", async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    await renderWithProviders(
      <ConfirmSheet
        open
        onClose={onClose}
        title="Close this lead?"
        description="It becomes read-only."
        confirmLabel="Close lead"
        onConfirm={onConfirm}
        testID="confirm"
      />,
    );
    expect(screen.getByText("It becomes read-only.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables both actions while loading", async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    await renderWithProviders(
      <ConfirmSheet
        open
        loading
        onClose={onClose}
        title="Working"
        description="Please wait."
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        testID="confirm"
      />,
    );
    await fireEvent.press(screen.getByTestId("confirm-confirm"));
    await fireEvent.press(screen.getByText("Cancel"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("holds what the step needs under its description, such as a reason", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(
      <ConfirmSheet
        open
        onClose={jest.fn()}
        title="Revoke this request?"
        description="Its link stops working."
        confirmLabel="Revoke"
        destructive
        onConfirm={jest.fn()}
        testID="confirm"
      >
        <Input label="Reason" value="" onChangeText={onChangeText} testID="confirm-reason" />
      </ConfirmSheet>,
    );
    expect(screen.getByText("Its link stops working.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("confirm-reason"), "Sent to the wrong hotel");
    expect(onChangeText).toHaveBeenCalledWith("Sent to the wrong hotel");
  });
});
