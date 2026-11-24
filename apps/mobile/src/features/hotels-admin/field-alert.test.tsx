import { AccessibilityInfo } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { FieldAlert } from "./field-alert";

// The tests run as iOS (jest-expo/ios), where neither role alert nor a live region speaks: VoiceOver
// hears an error under a chip group or a list of rows only if it is announced.
describe("FieldAlert", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shows the error as an alert and announces it when it appears", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    announce.mockClear();
    await renderWithProviders(<FieldAlert text="Give each layout once" testID="layouts-error" />);
    expect(screen.getByTestId("layouts-error")).toHaveTextContent("Give each layout once");
    expect(screen.getByRole("alert")).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith("Give each layout once", { queue: true });
  });

  it("announces a new error that takes the old one's place", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    announce.mockClear();
    const { rerender } = await renderWithProviders(
      <FieldAlert text="Choose the venue's setting" />,
    );
    await rerender(<FieldAlert text="Give each layout once" />);
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith("Give each layout once", { queue: true });
  });
});
