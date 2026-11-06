import { createRef, useState, type ComponentRef } from "react";
import type { TextInput } from "react-native";

import { uiCopy } from "../../copy";
import { spyOnAnnounce } from "../../test/announce";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { OtpInput, type OtpInputProps } from "./otp-input";
import { otpCellStyles } from "./otp-input.styles";
import { nextOtpValue, otpDigits } from "./otp-input.value";

// The cells are hidden from screen readers, so the queries must be told to look at hidden elements.
const HIDDEN = { includeHiddenElements: true } as const;

function cell(index: number): readonly string[] {
  return classes(screen.getByTestId(`otp-cell-${index}`, HIDDEN).props.className);
}

type HarnessProps = Omit<OtpInputProps, "value" | "onChangeText"> & {
  readonly initial?: string;
};

/** A screen that keeps the code in state, as a sign-in screen would. */
function Harness({ initial = "", ...props }: HarnessProps) {
  const [code, setCode] = useState(initial);
  return <OtpInput testID="otp" value={code} onChangeText={setCode} {...props} />;
}

describe("OtpInput", () => {
  it("is one field labelled for screen readers, with the number pad and SMS code autofill", async () => {
    await renderWithProviders(<Harness />);
    const field = screen.getByLabelText(uiCopy.otp.label);
    expect(field).toHaveProp("keyboardType", "number-pad");
    expect(field).toHaveProp("textContentType", "oneTimeCode");
    expect(field).toHaveProp("autoComplete", "one-time-code");
    expect(screen.getByText(uiCopy.otp.label)).toBeOnTheScreen();
  });

  it("keeps digits only, and never more than the length", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(
      <OtpInput testID="otp" value="" onChangeText={onChangeText} length={4} />,
    );
    await fireEvent.changeText(screen.getByTestId("otp"), "4a8 2-9 13");
    expect(onChangeText).toHaveBeenLastCalledWith("4829");
  });

  it("ignores a digit typed into a full code", async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<OtpInput testID="otp" value="482913" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByTestId("otp"), "4829135");
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it("fills the cells in order: filled peacock, empty pearl", async () => {
    await renderWithProviders(<Harness initial="482" />);
    expect(screen.getByTestId("otp")).toHaveDisplayValue("482");
    expect(cell(0)).toEqual(expect.arrayContaining(["bg-highlight/25", "border-highlight/70"]));
    expect(screen.getByText("8", HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByText("8")).toBeNull();
    expect(cell(3)).toEqual(expect.arrayContaining(["border-primary/20", "bg-surface/50"]));
  });

  it("marks the next cell gold while the field has focus", async () => {
    await renderWithProviders(<Harness initial="482" />);
    expect(cell(3)).not.toContain("border-brand");
    await fireEvent(screen.getByTestId("otp"), "focus");
    expect(cell(3)).toEqual(expect.arrayContaining(["border-brand", "web:shadow-halo"]));
    await fireEvent(screen.getByTestId("otp"), "blur");
    expect(cell(3)).not.toContain("border-brand");
  });

  it("hides the cells from screen readers", async () => {
    await renderWithProviders(<Harness initial="48" />);
    const row = screen.getByTestId("otp-cell-0", HIDDEN).parent;
    expect(row?.props.accessibilityElementsHidden).toBe(true);
    expect(row?.props["aria-hidden"]).toBe(true);
  });

  it("calls onComplete once when the code is complete, and again for a new code", async () => {
    const onComplete = jest.fn();
    await renderWithProviders(<Harness initial="48291" onComplete={onComplete} />);
    const field = screen.getByTestId("otp");
    await fireEvent.changeText(field, "482913");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("482913");
    await fireEvent.changeText(field, "4829135");
    expect(onComplete).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(field, "48291");
    await fireEvent.changeText(field, "482917");
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith("482917");
  });

  it("does not call onComplete for a full code it was given on mount", async () => {
    const onComplete = jest.fn();
    await renderWithProviders(<Harness initial="482913" onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("takes a pasted code whole, replacing digits already typed", async () => {
    const onComplete = jest.fn();
    await renderWithProviders(<Harness initial="48" onComplete={onComplete} />);
    await fireEvent.changeText(screen.getByTestId("otp"), "48731905");
    expect(screen.getByTestId("otp")).toHaveDisplayValue("731905");
    expect(onComplete).toHaveBeenCalledWith("731905");
  });

  it("shows an error in gold on every cell, keeps the digits and announces it", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(
      <Harness initial="482913" errorText="That code didn't match. Check the SMS and try again." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("That code didn't match.", {
      exact: false,
    });
    expect(classes(screen.getByRole("alert").props.className)).toContain("text-brand");
    expect(cell(0)).toContain("border-brand");
    expect(cell(5)).toContain("border-brand");
    expect(screen.getByTestId("otp")).toHaveDisplayValue("482913");
    expect(screen.getByTestId("otp")).toHaveProp("aria-invalid", true);
    expect(announce).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it("shows help text under the cells", async () => {
    await renderWithProviders(<Harness helpText="Sent by SMS just now" />);
    expect(classes(screen.getByText("Sent by SMS just now").props.className)).toContain(
      "text-muted",
    );
  });

  it("hands its ref to the real field", async () => {
    const ref = createRef<ComponentRef<typeof TextInput>>();
    await renderWithProviders(<OtpInput ref={ref} value="" onChangeText={jest.fn()} />);
    expect(ref.current).not.toBeNull();
  });

  it("cannot be edited when disabled", async () => {
    await renderWithProviders(<Harness initial="48" disabled />);
    expect(screen.getByTestId("otp")).toBeDisabled();
    expect(cell(0)).toContain("border-dashed");
  });

  it("draws each cell state from the tokens", () => {
    expect(classes(otpCellStyles({ state: "filled" }))).toEqual(
      expect.arrayContaining(["bg-highlight/25", "border-highlight/70", "rounded", "h-14", "w-12"]),
    );
    expect(classes(otpCellStyles({ state: "active" }))).toEqual(
      expect.arrayContaining(["border-brand", "web:shadow-halo"]),
    );
    expect(classes(otpCellStyles({ state: "empty" }))).toContain("border-primary/20");
    expect(classes(otpCellStyles({ state: "error" }))).toContain("border-brand");
  });
});

describe("nextOtpValue", () => {
  it.each([
    ["typed at the end", "48", "482", "482"],
    ["typed in front of the hidden caret: joins the end", "482", "1482", "4821"],
    ["deleted at the end", "482", "48", "48"],
    ["deleted in front: leaves from the end", "4821", "821", "482"],
    ["pasted into an empty field", "", "482913", "482913"],
    ["pasted after digits already typed", "48", "48731905", "731905"],
    ["pasted over a full code", "482913", "482913731905", "731905"],
    ["pasted with spaces and words", "", "Your code is 482 913", "482913"],
    ["typed past a full code", "482913", "4829135", "482913"],
    ["a selection replaced", "482913", "7", "7"],
    ["everything cleared", "482913", "", ""],
  ])("%s", (_, previous, text, expected) => {
    expect(nextOtpValue(previous, text, 6)).toBe(expected);
  });

  it("reads the digits of a value given by the screen", () => {
    expect(otpDigits("48-29-13-77", 6)).toBe("482913");
  });
});
