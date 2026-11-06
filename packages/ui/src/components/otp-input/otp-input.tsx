import { useEffect, useId, useRef, type ComponentRef, type Ref } from "react";
import { Platform, TextInput, View, type TextInputProps } from "react-native";

import { uiCopy } from "../../copy";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { FieldLabel, FieldMessage, useFocused } from "../input/input.parts";
import { Text } from "../text";
import {
  otpCellStyles,
  otpDigitStyles,
  otpFieldStyles,
  otpRowStyles,
  type OtpCellState,
} from "./otp-input.styles";
import { nextOtpValue, otpDigits } from "./otp-input.value";

export interface OtpInputProps extends Omit<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "editable"
  | "className"
  | "maxLength"
  | "multiline"
  | "keyboardType"
  | "placeholder"
  | "secureTextEntry"
> {
  /** The digits entered so far. */
  readonly value: string;
  /** Called with digits only, never more than `length` of them. */
  readonly onChangeText: (value: string) => void;
  /** How many digits the code has; 6 by default. */
  readonly length?: number | undefined;
  /** Shown above the cells and spoken for the field; defaults to "Verification code". */
  readonly label?: string | undefined;
  /** A line under the cells ("Sent by SMS just now"); the error replaces it. */
  readonly helpText?: string | undefined;
  /** Turns every cell's stroke gold and shows the message in gold; the digits stay. */
  readonly errorText?: string | undefined;
  /** Called once each time the code reaches `length` digits: typed, pasted or filled from an SMS. */
  readonly onComplete?: ((code: string) => void) | undefined;
  readonly disabled?: boolean | undefined;
  readonly ref?: Ref<ComponentRef<typeof TextInput>> | undefined;
  /** Classes for the whole block (label, cells, message). */
  readonly className?: string | undefined;
}

interface CellsProps {
  readonly code: string;
  readonly length: number;
  /** The cell the next digit goes into while the field has focus; -1 without focus. */
  readonly activeIndex: number;
  readonly hasError: boolean;
  readonly disabled: boolean;
  readonly testID: string | undefined;
}

function cellState(index: number, cells: CellsProps): OtpCellState {
  if (cells.disabled) return "disabled";
  if (index === cells.activeIndex) return "active";
  if (cells.hasError) return "error";
  return index < cells.code.length ? "filled" : "empty";
}

/** The cells only draw the code; screen readers and keyboards use the field laid over them. */
function OtpCells(cells: CellsProps) {
  return (
    <View
      className={otpRowStyles}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {Array.from({ length: cells.length }, (_, index) => (
        <View
          key={index}
          className={otpCellStyles({ state: cellState(index, cells) })}
          testID={cells.testID ? `${cells.testID}-cell-${index}` : undefined}
        >
          {cells.code[index] ? (
            <Text
              variant="data"
              tone={cells.disabled ? "disabled" : "primary"}
              className={otpDigitStyles}
            >
              {cells.code[index]}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

interface FieldProps extends Omit<
  OtpInputProps,
  "helpText" | "errorText" | "onComplete" | "className"
> {
  readonly label: string;
  readonly length: number;
  readonly labelId: string;
  /** Set while a help or error message is shown, so the field can point at it. */
  readonly messageId: string | undefined;
  readonly hasError: boolean;
  readonly disabled: boolean;
}

/** The real field: number pad, SMS code autofill, digits only, labelled for screen readers. */
function OtpTextInput({
  value,
  onChangeText,
  length,
  label,
  labelId,
  messageId,
  hasError,
  disabled,
  accessibilityLabel,
  ...rest
}: FieldProps) {
  return (
    <TextInput
      className={otpFieldStyles}
      value={value}
      onChangeText={(text) => {
        const next = nextOtpValue(value, text, length);
        if (next !== value) onChangeText(next);
      }}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
      caretHidden
      editable={!disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityLabelledBy={labelId}
      accessibilityState={{ disabled }}
      aria-invalid={hasError}
      {...(messageId ? { "aria-describedby": messageId } : {})}
      {...rest}
    />
  );
}

/** The cells with the real field over them, so a tap anywhere on the cells focuses it. */
function OtpField({ onFocus, onBlur, ...field }: FieldProps) {
  const focus = useFocused(onFocus, onBlur);
  const activeIndex = focus.focused ? Math.min(field.value.length, field.length - 1) : -1;
  return (
    <View>
      <OtpCells
        code={field.value}
        length={field.length}
        activeIndex={activeIndex}
        hasError={field.hasError}
        disabled={field.disabled}
        testID={field.testID}
      />
      <OtpTextInput {...field} onFocus={focus.handleFocus} onBlur={focus.handleBlur} />
    </View>
  );
}

/**
 * Reports a code once when it reaches `length` digits, by typing, paste, SMS autofill or a value the
 * screen sets; a full code already there on mount counts as reported, so nothing submits by itself.
 */
function useCompletion(code: string, length: number, onComplete: OtpInputProps["onComplete"]) {
  const reported = useRef(code.length === length ? code : null);
  useEffect(() => {
    if (code.length < length) {
      reported.current = null;
      return;
    }
    if (reported.current === code) return;
    reported.current = code;
    onComplete?.(code);
  }, [code, length, onComplete]);
}

/**
 * The one-time code field of the sign-in screens (D1, P1): six cells of 48 × 56, filled cells in
 * peacock, the next cell in gold with the halo, an error in gold that keeps the digits. One real
 * TextInput lies over the cells, so taps, paste, the number pad and SMS code autofill (iOS
 * oneTimeCode, Android sms-otp) all reach a single field; the cells are hidden from screen readers
 * and the field carries the label and the value. Digits only; `onComplete` fires once per full code.
 *
 *   <OtpInput label="Six-digit code" value={code} onChangeText={setCode} onComplete={verify} helpText="Sent by SMS just now" errorText={error} autoFocus />
 */
export function OtpInput({
  value,
  length = 6,
  label = uiCopy.otp.label,
  helpText,
  errorText,
  onComplete,
  disabled = false,
  className,
  ...field
}: OtpInputProps) {
  const labelId = useId();
  const messageId = useId();
  const code = otpDigits(value, length);
  useCompletion(code, length, onComplete);
  const message = errorText ?? helpText;
  const hasError = Boolean(errorText);
  return (
    <View className={cn("gap-2", className)}>
      <FieldLabel id={labelId} label={label} disabled={disabled} />
      <OtpField
        {...field}
        value={code}
        length={length}
        label={label}
        labelId={labelId}
        messageId={message ? messageId : undefined}
        hasError={hasError}
        disabled={disabled}
      />
      <FieldMessage
        id={messageId}
        text={message}
        isError={hasError}
        isHidden={isHiddenFromVoiceOver({ className })}
      />
    </View>
  );
}
