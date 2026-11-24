import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { MediaOptionPicker } from "./media-option-picker";

const SETTINGS: readonly string[] = ["indoor", "outdoor", "semi_open"];
const label = (setting: string): string => setting.replace("_", " ");

describe("MediaOptionPicker", () => {
  it("offers its options as a labelled radio group and reports the choice", async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <MediaOptionPicker
        label="Setting"
        value="indoor"
        options={SETTINGS}
        optionLabel={label}
        onChange={onChange}
        testID="setting"
      />,
    );
    expect(screen.getByTestId("setting")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByTestId("setting")).toHaveProp("accessibilityLabel", "Setting");
    expect(screen.getByTestId("setting-indoor")).toBeChecked();
    await fireEvent.press(screen.getByTestId("setting-outdoor"));
    expect(onChange).toHaveBeenCalledWith("outdoor");
  });

  // A required group is marked as an Input is: an asterisk drawn for the eye, "…, required" for a
  // native screen reader (never "star"), and aria-required for the web.
  it("marks a required group with a drawn asterisk and says it is required", async () => {
    await renderWithProviders(
      <MediaOptionPicker
        label="Setting"
        value={null}
        options={SETTINGS}
        optionLabel={label}
        onChange={jest.fn()}
        required
        testID="setting"
      />,
    );
    const group = screen.getByTestId("setting");
    expect(group).toHaveProp("accessibilityLabel", "Setting, required");
    expect(group).toHaveProp("aria-required", true);
    expect(screen.getByText("Setting", { exact: false })).toHaveProp(
      "accessibilityLabel",
      "Setting, required",
    );
    expect(screen.getByText("*", { exact: false, includeHiddenElements: true })).toHaveProp(
      "aria-hidden",
      true,
    );
  });

  it("leaves an optional group unmarked", async () => {
    await renderWithProviders(
      <MediaOptionPicker
        label="Unit type"
        value={null}
        options={SETTINGS}
        optionLabel={label}
        onChange={jest.fn()}
        testID="unit"
      />,
    );
    expect(screen.getByTestId("unit")).toHaveProp("accessibilityLabel", "Unit type");
    expect(screen.queryByText("*", { exact: false, includeHiddenElements: true })).toBeNull();
  });
});
