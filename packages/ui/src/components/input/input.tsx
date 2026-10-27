import { useId, useState, type ComponentRef, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { colors } from "@ampm/tokens";

import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import { fieldStyles, type InputSize } from "./input.styles";

export interface InputProps extends Omit<TextInputProps, "editable" | "className"> {
  readonly label: string;
  readonly helpText?: string | undefined;
  /** Shown instead of the help text; marks the field invalid and is announced. */
  readonly errorText?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly size?: InputSize | undefined;
  readonly leadingIcon?: IconName | undefined;
  readonly ref?: Ref<ComponentRef<typeof TextInput>> | undefined;
  /** Classes for the whole field block (label, frame, message). */
  readonly className?: string | undefined;
}

interface LabelProps {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly disabled: boolean;
}

function FieldLabel({ id, label, required, disabled }: LabelProps) {
  return (
    <Text variant="label" tone={disabled ? "muted" : "primary"} nativeID={id}>
      {label}
      {required ? " *" : ""}
    </Text>
  );
}

interface MessageProps {
  readonly id: string;
  readonly text: string | undefined;
  readonly isError: boolean;
}

function FieldMessage({ id, text, isError }: MessageProps) {
  if (!text) return null;
  return (
    <Text
      variant="caption"
      tone={isError ? "danger" : "muted"}
      nativeID={id}
      accessibilityLiveRegion={isError ? "polite" : "none"}
      {...(isError ? { accessibilityRole: "alert" as const } : {})}
    >
      {text}
    </Text>
  );
}

/** Tracks focus for the visual state; the caller's own handlers still run. */
function useFocused(onFocus: TextInputProps["onFocus"], onBlur: TextInputProps["onBlur"]) {
  const [focused, setFocused] = useState(false);
  const handleFocus: NonNullable<TextInputProps["onFocus"]> = (event) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur: NonNullable<TextInputProps["onBlur"]> = (event) => {
    setFocused(false);
    onBlur?.(event);
  };
  return { focused, handleFocus, handleBlur };
}

interface ControlProps extends Omit<
  InputProps,
  "helpText" | "errorText" | "required" | "className"
> {
  readonly labelId: string;
  /** Set while a help or error message is shown, so the input can point at it. */
  readonly messageId: string | undefined;
  readonly hasError: boolean;
  readonly disabled: boolean;
  readonly size: InputSize;
}

/** The frame with the optional icon and the text input; owns the focus state. */
function FieldControl({
  label,
  labelId,
  messageId,
  hasError,
  disabled,
  size,
  leadingIcon,
  ref,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...rest
}: ControlProps) {
  const { resolved } = useTheme();
  const focus = useFocused(onFocus, onBlur);
  const state = disabled ? "disabled" : hasError ? "error" : focus.focused ? "focused" : "default";
  return (
    <View className={fieldStyles({ state, size })}>
      {leadingIcon ? <Icon name={leadingIcon} tone="muted" /> : null}
      <TextInput
        ref={ref}
        className="flex-1 py-2 font-sans text-base text-primary web:outline-none"
        placeholderTextColor={colors.muted[resolved]}
        selectionColor={colors.brand[resolved]}
        editable={!disabled}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityLabelledBy={labelId}
        accessibilityState={{ disabled }}
        aria-invalid={hasError}
        {...(messageId ? { "aria-describedby": messageId } : {})}
        onFocus={focus.handleFocus}
        onBlur={focus.handleBlur}
        {...rest}
      />
    </View>
  );
}

/**
 * A labelled text field. States: default, focused, error, disabled. The label is tied to the input
 * for screen readers; the error is a live region. Every state keeps the 44px target.
 *
 *   <Input label="Email" keyboardType="email-address" value={email} onChangeText={setEmail} errorText={errors.email} />
 */
export function Input({
  label,
  helpText,
  errorText,
  disabled = false,
  required = false,
  size = "md",
  leadingIcon,
  className,
  ...control
}: InputProps) {
  const labelId = useId();
  const messageId = useId();
  const message = errorText ?? helpText;
  const hasError = Boolean(errorText);
  return (
    <View className={cn("gap-1", className)}>
      <FieldLabel id={labelId} label={label} required={required} disabled={disabled} />
      <FieldControl
        {...control}
        label={label}
        labelId={labelId}
        messageId={message ? messageId : undefined}
        hasError={hasError}
        disabled={disabled}
        size={size}
        leadingIcon={leadingIcon}
      />
      <FieldMessage id={messageId} text={message} isError={hasError} />
    </View>
  );
}
