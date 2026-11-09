import { createRef, useState, type ComponentRef } from "react";
import type { Pressable } from "react-native";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Select, type SelectOption } from "./select";

const OPTIONS: readonly SelectOption<string>[] = [
  { value: "udaipur", label: "Udaipur" },
  { value: "jaipur", label: "Jaipur" },
  { value: "goa", label: "Goa" },
];

function Harness(props: {
  readonly initial?: string | null;
  readonly onChange?: (value: string) => void;
  readonly errorText?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly searchable?: boolean | undefined;
  readonly options?: readonly SelectOption<string>[] | undefined;
}) {
  const [value, setValue] = useState<string | null>(props.initial ?? null);
  return (
    <Select
      label="Destination"
      placeholder="Choose a destination"
      options={props.options ?? OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
      errorText={props.errorText}
      disabled={props.disabled}
      searchable={props.searchable}
      testID="dest"
    />
  );
}

describe("Select", () => {
  it("shows the label and the placeholder until a value is chosen", async () => {
    await renderWithProviders(<Harness />);
    expect(screen.getByText("Destination")).toBeOnTheScreen();
    expect(screen.getByTestId("dest")).toHaveProp(
      "accessibilityLabel",
      "Destination: Choose a destination",
    );
    // The option sheet stays closed until the trigger is pressed.
    expect(screen.queryByTestId("dest-option-goa")).toBeNull();
  });

  it("opens the sheet, chooses a value, then closes and names the choice on the trigger", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("dest"));
    expect(await screen.findByTestId("dest-option-jaipur")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("dest-option-jaipur"));
    expect(onChange).toHaveBeenCalledWith("jaipur");
    expect(screen.getByTestId("dest")).toHaveProp("accessibilityLabel", "Destination: Jaipur");
    // Choosing closes the sheet.
    expect(screen.queryByTestId("dest-option-jaipur")).toBeNull();
  });

  it("marks the chosen option as checked, the rest unchecked", async () => {
    await renderWithProviders(<Harness initial="goa" />);
    await fireEvent.press(screen.getByTestId("dest"));
    expect(screen.getByTestId("dest-option-goa")).toHaveProp("accessibilityState", {
      checked: true,
      disabled: false,
    });
    expect(screen.getByTestId("dest-option-udaipur")).toHaveProp("accessibilityState", {
      checked: false,
      disabled: false,
    });
  });

  it("does not open when disabled", async () => {
    await renderWithProviders(<Harness disabled initial="udaipur" />);
    expect(screen.getByTestId("dest")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("dest"));
    expect(screen.queryByTestId("dest-option-udaipur")).toBeNull();
  });

  it("shows the error in gold on a gold stroke and marks the trigger invalid", async () => {
    await renderWithProviders(<Harness errorText="Choose a destination." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a destination.");
    expect(classes(screen.getByTestId("dest").props.className)).toContain("border-brand");
    expect(screen.getByTestId("dest")).toHaveProp("aria-invalid", true);
  });

  it("filters the options with the search box, and says when nothing matches", async () => {
    await renderWithProviders(<Harness searchable />);
    await fireEvent.press(screen.getByTestId("dest"));
    await fireEvent.changeText(screen.getByTestId("dest-search"), "go");
    expect(screen.getByTestId("dest-option-goa")).toBeOnTheScreen();
    expect(screen.queryByTestId("dest-option-udaipur")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("dest-search"), "zzz");
    expect(screen.getByTestId("dest-empty")).toHaveTextContent("No matches");
  });

  it("shows the empty label when there are no options", async () => {
    await renderWithProviders(<Harness options={[]} />);
    await fireEvent.press(screen.getByTestId("dest"));
    expect(screen.getByTestId("dest-empty")).toHaveTextContent("No options");
  });

  it("forwards its ref to the focusable trigger", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(
      <Select
        label="Destination"
        value={null}
        options={OPTIONS}
        onChange={() => {}}
        ref={ref}
        testID="dest"
      />,
    );
    expect(ref.current).not.toBeNull();
  });

  it("renders a disabled option but does not let it be chosen", async () => {
    const onChange = jest.fn();
    const options: readonly SelectOption<string>[] = [
      { value: "udaipur", label: "Udaipur" },
      { value: "goa", label: "Goa", disabled: true },
    ];
    await renderWithProviders(<Harness onChange={onChange} options={options} />);
    await fireEvent.press(screen.getByTestId("dest"));
    expect(screen.getByTestId("dest-option-goa")).toHaveProp("accessibilityState", {
      checked: false,
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId("dest-option-goa"));
    expect(onChange).not.toHaveBeenCalled();
    // The sheet stays open after a blocked option.
    expect(screen.getByTestId("dest-option-udaipur")).toBeOnTheScreen();
  });

  it("chooses a filtered option, then clears the search on reopen", async () => {
    const onChange = jest.fn();
    await renderWithProviders(<Harness searchable onChange={onChange} />);
    await fireEvent.press(screen.getByTestId("dest"));
    await fireEvent.changeText(screen.getByTestId("dest-search"), "go");
    await fireEvent.press(screen.getByTestId("dest-option-goa"));
    expect(onChange).toHaveBeenCalledWith("goa");
    await fireEvent.press(screen.getByTestId("dest"));
    expect(screen.getByTestId("dest-option-udaipur")).toBeOnTheScreen();
    expect(screen.getByTestId("dest-option-jaipur")).toBeOnTheScreen();
  });

  it("clears the search when the sheet is dismissed from the scrim and reopened", async () => {
    await renderWithProviders(<Harness searchable />);
    await fireEvent.press(screen.getByTestId("dest"));
    await fireEvent.changeText(screen.getByTestId("dest-search"), "zzz");
    expect(screen.getByTestId("dest-empty")).toHaveTextContent("No matches");
    await fireEvent.press(screen.getByTestId("dest-sheet-scrim", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByTestId("dest"));
    expect(screen.getByTestId("dest-option-udaipur")).toBeOnTheScreen();
  });
});
