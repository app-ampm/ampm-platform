import { createRef, useState, type ComponentRef } from "react";
import type { Pressable } from "react-native";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import type { DateRange } from "./date-range";
import { DateRangeField } from "./date-range-field";

// A fixed "now": 2026-11-09T12:00:00Z, so the preset ranges are deterministic.
const NOW = Date.UTC(2026, 10, 9, 12, 0, 0);

function Harness(props: {
  readonly initial?: DateRange;
  readonly onChange?: (range: DateRange) => void;
  readonly errorText?: string | undefined;
  readonly disabled?: boolean | undefined;
}) {
  const [value, setValue] = useState<DateRange>(props.initial ?? {});
  return (
    <DateRangeField
      label="Date range"
      now={NOW}
      value={value}
      onChange={(range) => {
        setValue(range);
        props.onChange?.(range);
      }}
      errorText={props.errorText}
      disabled={props.disabled}
      testID="range"
    />
  );
}

describe("DateRangeField", () => {
  it("labels the trigger with the matched preset, defaulting to All time", async () => {
    await renderWithProviders(<Harness />);
    expect(screen.getByTestId("range")).toHaveProp("accessibilityLabel", "Date range: All time");
    await fireEvent.press(screen.getByTestId("range"));
    expect(screen.getByTestId("range-preset-all")).toHaveProp("accessibilityState", {
      checked: true,
    });
  });

  it("selects a preset, emitting its range and closing", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("range"));
    await fireEvent.press(screen.getByTestId("range-preset-last_30"));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-10", to: "2026-11-09" });
    expect(screen.getByTestId("range")).toHaveProp(
      "accessibilityLabel",
      "Date range: Last 30 days",
    );
    expect(screen.queryByTestId("range-preset-last_30")).toBeNull();
  });

  it("applies a custom from/to range", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("range"));
    await fireEvent.changeText(screen.getByTestId("range-from"), "2026-03-01");
    await fireEvent.changeText(screen.getByTestId("range-to"), "2026-03-31");
    await fireEvent.press(screen.getByTestId("range-apply"));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-03-01", to: "2026-03-31" });
    // The visible trigger shows "→"; its accessible name speaks it as "to".
    expect(screen.getByTestId("range")).toHaveProp(
      "accessibilityLabel",
      "Date range: 2026-03-01 to 2026-03-31",
    );
  });

  it("applies a half-open custom range (from only)", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("range"));
    await fireEvent.changeText(screen.getByTestId("range-from"), "2026-03-01");
    await fireEvent.press(screen.getByTestId("range-apply"));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-03-01", to: undefined });
    expect(screen.getByTestId("range")).toHaveProp(
      "accessibilityLabel",
      "Date range: 2026-03-01 to …",
    );
  });

  it("keeps Apply disabled and names the problem for a malformed custom date", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("range"));
    await fireEvent.changeText(screen.getByTestId("range-from"), "2026-13-01");
    expect(screen.getByText("Enter the date as YYYY-MM-DD.")).toBeOnTheScreen();
    expect(screen.getByTestId("range-apply")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("range-apply"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks an out-of-order custom range with an announced error", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("range"));
    await fireEvent.changeText(screen.getByTestId("range-from"), "2026-05-01");
    await fireEvent.changeText(screen.getByTestId("range-to"), "2026-04-01");
    expect(screen.getByText("The end date is before the start date.")).toBeOnTheScreen();
    expect(screen.getByTestId("range-apply")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("range-apply"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reseeds the custom fields from the value on each open", async () => {
    await renderWithProviders(<Harness />);
    await fireEvent.press(screen.getByTestId("range"));
    await fireEvent.changeText(screen.getByTestId("range-from"), "2026-07-07");
    await fireEvent.press(screen.getByTestId("range-sheet-scrim", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByTestId("range"));
    expect(screen.queryByDisplayValue("2026-07-07")).toBeNull();
  });

  it("does not open when disabled", async () => {
    await renderWithProviders(<Harness disabled />);
    expect(screen.getByTestId("range")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("range"));
    expect(screen.queryByTestId("range-preset-all")).toBeNull();
  });

  it("shows the error in gold on a gold stroke and marks the trigger invalid", async () => {
    await renderWithProviders(<Harness errorText="Pick a date range." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a date range.");
    expect(classes(screen.getByTestId("range").props.className)).toContain("border-brand");
    expect(screen.getByTestId("range")).toHaveProp("aria-invalid", true);
  });

  it("forwards its ref to the focusable trigger", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(
      <DateRangeField
        label="Date range"
        now={NOW}
        value={{}}
        onChange={() => {}}
        ref={ref}
        testID="range"
      />,
    );
    expect(ref.current).not.toBeNull();
  });
});
